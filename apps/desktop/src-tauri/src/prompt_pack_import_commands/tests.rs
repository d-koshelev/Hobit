use super::*;

use std::{
    fs,
    time::{SystemTime, UNIX_EPOCH},
};

#[test]
fn reads_repo_self_development_fixture_entries() {
    let source_path = repo_root().join(
        "apps/desktop/frontend/src/workbench/promptPack/fixtures/self-development-smoke-prompt-pack",
    );

    let source = read_prompt_pack_source_blocking(ReadPromptPackSourceRequest {
        path: source_path.to_string_lossy().to_string(),
    })
    .expect("read prompt-pack fixture");

    let paths = source
        .files
        .iter()
        .map(|file| file.relative_path.as_str())
        .collect::<Vec<_>>();
    assert_eq!(
        paths,
        vec![
            "001-safe-docs-noop.md",
            "002-dependent-follow-up.md",
            "README.md",
            "prompt-batch.json",
        ]
    );
    assert!(source
        .files
        .iter()
        .any(|file| file.relative_path == "001-safe-docs-noop.md"
            && file.text.contains("No hidden execution.")));
    assert!(source
        .files
        .iter()
        .any(|file| file.relative_path == "002-dependent-follow-up.md"
            && file.text.contains("no auto-run expectation")));
}

#[test]
fn reads_manifest_file_path_with_sibling_prompt_bodies() {
    let dir = unique_temp_dir();
    fs::write(dir.join("README.md"), "# Pack").expect("write readme");
    fs::write(
        dir.join("prompt-batch.json"),
        r#"{"items":[{"id":"001","path":"001-one.md"},{"id":"002","path":"002-two.md","dependencies":["001"]}]}"#,
    )
    .expect("write manifest");
    fs::write(dir.join("001-one.md"), "# One\n\nFirst body").expect("write first");
    fs::write(dir.join("002-two.md"), "# Two\n\nSecond body").expect("write second");

    let source = read_prompt_pack_source_blocking(ReadPromptPackSourceRequest {
        path: dir.join("prompt-batch.json").to_string_lossy().to_string(),
    })
    .expect("read prompt-pack source");

    assert_eq!(source.source_kind, "file");
    assert_eq!(source.files.len(), 4);
    assert!(source
        .files
        .iter()
        .any(|file| file.relative_path == "001-one.md" && file.text.contains("First body")));

    remove_temp_dir(dir);
}

#[test]
fn rejects_missing_source_path() {
    let error = read_prompt_pack_source_blocking(ReadPromptPackSourceRequest {
        path: "C:/definitely/missing/prompt-pack".to_owned(),
    })
    .expect_err("missing source rejected");

    assert!(error.contains("could not be read"));
}

#[test]
fn rejects_unsupported_files_in_scanned_folder() {
    let dir = unique_temp_dir();
    fs::write(dir.join("prompt-batch.json"), "{}").expect("write manifest");
    fs::write(dir.join("logo.png"), [0_u8, 1, 2, 3]).expect("write unsupported file");

    let error = read_prompt_pack_source_blocking(ReadPromptPackSourceRequest {
        path: dir.to_string_lossy().to_string(),
    })
    .expect_err("unsupported file rejected");

    assert!(error.contains("Unsupported prompt-pack file"));
    remove_temp_dir(dir);
}

#[test]
fn rejects_large_allowed_file() {
    let dir = unique_temp_dir();
    fs::write(
        dir.join("001-large.md"),
        vec![b'a'; (MAX_PROMPT_PACK_FILE_BYTES as usize) + 1],
    )
    .expect("write large prompt");

    let error = read_prompt_pack_source_blocking(ReadPromptPackSourceRequest {
        path: dir.to_string_lossy().to_string(),
    })
    .expect_err("large file rejected");

    assert!(error.contains("too large"));
    remove_temp_dir(dir);
}

#[test]
fn rejects_binary_allowed_file() {
    let dir = unique_temp_dir();
    fs::write(dir.join("001-binary.md"), [0xff, 0xfe, 0xfd]).expect("write binary prompt");

    let error = read_prompt_pack_source_blocking(ReadPromptPackSourceRequest {
        path: dir.to_string_lossy().to_string(),
    })
    .expect_err("binary file rejected");

    assert!(error.contains("valid UTF-8"));
    remove_temp_dir(dir);
}

fn repo_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .and_then(Path::parent)
        .and_then(Path::parent)
        .expect("repo root")
        .to_path_buf()
}

fn unique_temp_dir() -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time after unix epoch")
        .as_nanos();
    let dir = std::env::temp_dir().join(format!(
        "hobit-prompt-pack-import-test-{}-{nanos}",
        std::process::id()
    ));
    fs::create_dir_all(&dir).expect("create temp test directory");
    dir
}

fn remove_temp_dir(path: PathBuf) {
    let _ = fs::remove_dir_all(path);
}
