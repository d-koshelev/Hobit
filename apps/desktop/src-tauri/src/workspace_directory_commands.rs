#[tauri::command]
pub async fn select_workspace_directory() -> Result<Option<String>, String> {
    select_workspace_directory_impl()
}

#[cfg(windows)]
fn select_workspace_directory_impl() -> Result<Option<String>, String> {
    use std::ptr::null_mut;
    use windows_sys::Win32::Foundation::{FALSE, MAX_PATH, S_FALSE, S_OK};
    use windows_sys::Win32::System::Com::{
        CoInitializeEx, CoTaskMemFree, CoUninitialize, COINIT_APARTMENTTHREADED,
        COINIT_DISABLE_OLE1DDE,
    };
    use windows_sys::Win32::UI::Shell::{
        SHBrowseForFolderW, SHGetPathFromIDListW, BIF_NEWDIALOGSTYLE, BIF_RETURNONLYFSDIRS,
        BROWSEINFOW,
    };

    let init_flags = (COINIT_APARTMENTTHREADED | COINIT_DISABLE_OLE1DDE) as u32;
    let init_result = unsafe { CoInitializeEx(null_mut(), init_flags) };
    let should_uninitialize = init_result == S_OK || init_result == S_FALSE;
    if init_result < 0 {
        return Err("Unable to initialize the Windows directory picker.".to_string());
    }

    let title = wide_null("Select Workspace Agent working directory");
    let mut display_name = [0u16; MAX_PATH as usize];
    let browse_info = BROWSEINFOW {
        hwndOwner: null_mut(),
        pidlRoot: null_mut(),
        pszDisplayName: display_name.as_mut_ptr(),
        lpszTitle: title.as_ptr(),
        ulFlags: BIF_RETURNONLYFSDIRS | BIF_NEWDIALOGSTYLE,
        lpfn: None,
        lParam: 0,
        iImage: 0,
    };

    let selected_item = unsafe { SHBrowseForFolderW(&browse_info) };
    if selected_item.is_null() {
        if should_uninitialize {
            unsafe { CoUninitialize() };
        }
        return Ok(None);
    }

    let mut path = [0u16; MAX_PATH as usize];
    let got_path = unsafe { SHGetPathFromIDListW(selected_item, path.as_mut_ptr()) };
    unsafe { CoTaskMemFree(selected_item.cast()) };
    if should_uninitialize {
        unsafe { CoUninitialize() };
    }

    if got_path == FALSE {
        return Err("Unable to read the selected directory path.".to_string());
    }

    Ok(Some(wide_path_to_string(&path)))
}

#[cfg(not(windows))]
fn select_workspace_directory_impl() -> Result<Option<String>, String> {
    Err(
        "Workspace Agent directory Browse is only available in the Windows desktop shell."
            .to_string(),
    )
}

#[cfg(windows)]
fn wide_null(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(std::iter::once(0)).collect()
}

#[cfg(windows)]
fn wide_path_to_string(value: &[u16]) -> String {
    let end = value
        .iter()
        .position(|code_unit| *code_unit == 0)
        .unwrap_or(value.len());
    String::from_utf16_lossy(&value[..end])
}
