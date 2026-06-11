use std::{
    fs,
    path::{Path, PathBuf},
};

use crate::prompt_pack_import_dto::{
    PromptPackImportFileDto, PromptPackImportSourceDto, ReadPromptPackSourceRequest,
};

const MAX_PROMPT_PACK_FILE_BYTES: u64 = 512 * 1024;
const MAX_PROMPT_PACK_TOTAL_BYTES: u64 = 2 * 1024 * 1024;
const MAX_PROMPT_PACK_FILES: usize = 64;

#[tauri::command]
pub(crate) fn read_prompt_pack_source(
    request: ReadPromptPackSourceRequest,
) -> Result<PromptPackImportSourceDto, String> {
    read_prompt_pack_source_blocking(request)
}

fn read_prompt_pack_source_blocking(
    request: ReadPromptPackSourceRequest,
) -> Result<PromptPackImportSourceDto, String> {
    let trimmed_path = request.path.trim();
    if trimmed_path.is_empty() {
        return Err("Prompt-pack source path is required.".to_owned());
    }

    let input_path = Path::new(trimmed_path);
    let input_metadata = fs::symlink_metadata(input_path)
        .map_err(|_| "Prompt-pack source path could not be read.".to_owned())?;
    if input_metadata.file_type().is_symlink() {
        return Err("Prompt-pack source path must not be a symlink.".to_owned());
    }

    let source_kind = if input_metadata.is_dir() {
        "folder"
    } else if input_metadata.is_file() {
        "file"
    } else {
        return Err("Prompt-pack source must be a folder or file.".to_owned());
    };

    let root = if input_metadata.is_dir() {
        input_path.to_path_buf()
    } else {
        input_path
            .parent()
            .ok_or_else(|| "Prompt-pack file must have a parent folder.".to_owned())?
            .to_path_buf()
    };
    let canonical_root = root
        .canonicalize()
        .map_err(|_| "Prompt-pack source root could not be resolved.".to_owned())?;

    let mut candidates = Vec::new();
    collect_prompt_pack_candidates(&canonical_root, &mut candidates)?;
    candidates.sort();
    candidates.dedup();

    if candidates.is_empty() {
        return Err(
            "Prompt-pack source contains no README.md, prompt-batch.json, or numbered Markdown prompt files."
                .to_owned(),
        );
    }
    if candidates.len() > MAX_PROMPT_PACK_FILES {
        return Err(format!(
            "Prompt-pack source has too many supported files. Limit is {MAX_PROMPT_PACK_FILES} files."
        ));
    }

    let mut files = Vec::with_capacity(candidates.len());
    let mut total_bytes = 0_u64;
    for path in candidates {
        let canonical_path = path
            .canonicalize()
            .map_err(|_| "Prompt-pack file path could not be resolved.".to_owned())?;
        if !canonical_path.starts_with(&canonical_root) {
            return Err("Prompt-pack file escaped the selected source root.".to_owned());
        }

        let relative_path = relative_prompt_pack_path(&canonical_root, &canonical_path)?;
        let file_name = canonical_path
            .file_name()
            .and_then(|file_name| file_name.to_str())
            .ok_or_else(|| "Prompt-pack file must have a valid UTF-8 name.".to_owned())?
            .to_owned();
        let metadata = fs::metadata(&canonical_path)
            .map_err(|_| format!("Unable to read metadata for \"{relative_path}\"."))?;
        if !metadata.is_file() {
            return Err(format!(
                "Prompt-pack entry \"{relative_path}\" is not a file."
            ));
        }
        if metadata.len() > MAX_PROMPT_PACK_FILE_BYTES {
            return Err(format!(
                "Prompt-pack file \"{relative_path}\" is too large. Limit is 512 KB per file."
            ));
        }
        total_bytes = total_bytes.saturating_add(metadata.len());
        if total_bytes > MAX_PROMPT_PACK_TOTAL_BYTES {
            return Err("Prompt-pack source is too large. Limit is 2 MB total.".to_owned());
        }

        let bytes = fs::read(&canonical_path)
            .map_err(|_| format!("Unable to read prompt-pack file \"{relative_path}\"."))?;
        if bytes.len() as u64 > MAX_PROMPT_PACK_FILE_BYTES {
            return Err(format!(
                "Prompt-pack file \"{relative_path}\" is too large. Limit is 512 KB per file."
            ));
        }
        let text = String::from_utf8(bytes).map_err(|_| {
            format!("Prompt-pack file \"{relative_path}\" is not valid UTF-8 text.")
        })?;

        files.push(PromptPackImportFileDto {
            relative_path,
            file_name,
            byte_size: metadata.len(),
            text,
        });
    }

    Ok(PromptPackImportSourceDto {
        source_path: trimmed_path.to_owned(),
        source_kind: source_kind.to_owned(),
        files,
    })
}

fn collect_prompt_pack_candidates(
    root: &Path,
    candidates: &mut Vec<PathBuf>,
) -> Result<(), String> {
    collect_prompt_pack_directory(root, root, candidates)?;

    for entry in fs::read_dir(root).map_err(|_| "Unable to list prompt-pack source.".to_owned())? {
        let entry = entry.map_err(|_| "Unable to inspect prompt-pack source entry.".to_owned())?;
        let path = entry.path();
        let metadata = fs::symlink_metadata(&path)
            .map_err(|_| "Unable to inspect prompt-pack source entry metadata.".to_owned())?;
        if metadata.file_type().is_symlink() {
            return Err("Prompt-pack source must not contain symlink entries.".to_owned());
        }
        if metadata.is_dir() && is_safe_prompt_pack_subfolder(&path) {
            collect_prompt_pack_directory(root, &path, candidates)?;
        }
    }

    Ok(())
}

fn collect_prompt_pack_directory(
    root: &Path,
    directory: &Path,
    candidates: &mut Vec<PathBuf>,
) -> Result<(), String> {
    for entry in fs::read_dir(directory).map_err(|_| {
        format!(
            "Unable to list prompt-pack folder \"{}\".",
            directory.display()
        )
    })? {
        let entry = entry.map_err(|_| "Unable to inspect prompt-pack folder entry.".to_owned())?;
        let path = entry.path();
        let metadata = fs::symlink_metadata(&path)
            .map_err(|_| "Unable to inspect prompt-pack entry metadata.".to_owned())?;
        if metadata.file_type().is_symlink() {
            return Err("Prompt-pack source must not contain symlink entries.".to_owned());
        }
        if metadata.is_dir() {
            continue;
        }
        if !metadata.is_file() {
            return Err("Prompt-pack source contains an unsupported filesystem entry.".to_owned());
        }
        if is_ignored_prompt_pack_file(&path) {
            continue;
        }
        if is_allowed_prompt_pack_file(root, &path)? {
            candidates.push(path);
            continue;
        }

        let relative_path =
            relative_prompt_pack_path(root, &path).unwrap_or_else(|_| path.display().to_string());
        return Err(format!(
            "Unsupported prompt-pack file \"{relative_path}\". Only README.md, prompt-batch.json, and numbered Markdown prompt files are allowed."
        ));
    }

    Ok(())
}

fn is_allowed_prompt_pack_file(root: &Path, path: &Path) -> Result<bool, String> {
    let relative_path = relative_prompt_pack_path(root, path)?;
    let relative = relative_path.replace('\\', "/");
    if relative.contains("../") || relative.starts_with('/') {
        return Ok(false);
    }

    let parts = relative.split('/').collect::<Vec<_>>();
    if parts.len() > 2 {
        return Ok(false);
    }
    if parts.len() == 2 && !is_safe_prompt_pack_subfolder_name(parts[0]) {
        return Ok(false);
    }

    let file_name = parts.last().copied().unwrap_or_default();
    let lower = file_name.to_ascii_lowercase();
    Ok(lower == "readme.md" || lower == "prompt-batch.json" || is_numbered_markdown_file(&lower))
}

fn is_numbered_markdown_file(file_name: &str) -> bool {
    if !(file_name.ends_with(".md") || file_name.ends_with(".markdown")) {
        return false;
    }

    let stem = file_name
        .strip_suffix(".markdown")
        .or_else(|| file_name.strip_suffix(".md"))
        .unwrap_or(file_name);
    let bytes = stem.as_bytes();
    if bytes.len() < 3 {
        return false;
    }
    if !(bytes[0].is_ascii_digit() && bytes[1].is_ascii_digit() && bytes[2].is_ascii_digit()) {
        return false;
    }
    bytes.len() == 3
        || (bytes.len() > 4
            && bytes[3] == b'-'
            && bytes[4..].iter().any(|byte| byte.is_ascii_alphanumeric()))
}

fn is_safe_prompt_pack_subfolder(path: &Path) -> bool {
    path.file_name()
        .and_then(|name| name.to_str())
        .map(is_safe_prompt_pack_subfolder_name)
        .unwrap_or(false)
}

fn is_safe_prompt_pack_subfolder_name(name: &str) -> bool {
    matches!(
        name.to_ascii_lowercase().as_str(),
        "prompts" | "prompt" | "tasks" | "blocks" | "prompt-pack" | "prompt-packs"
    )
}

fn is_ignored_prompt_pack_file(path: &Path) -> bool {
    path.file_name()
        .and_then(|name| name.to_str())
        .map(|name| name.starts_with('.'))
        .unwrap_or(false)
}

fn relative_prompt_pack_path(root: &Path, path: &Path) -> Result<String, String> {
    let relative = path
        .strip_prefix(root)
        .map_err(|_| "Prompt-pack file is outside the selected source root.".to_owned())?;
    let parts = relative
        .components()
        .map(|component| {
            component
                .as_os_str()
                .to_str()
                .ok_or_else(|| "Prompt-pack path must be valid UTF-8.".to_owned())
        })
        .collect::<Result<Vec<_>, _>>()?;

    Ok(parts.join("/"))
}

#[cfg(test)]
mod tests;
