use std::ffi::{c_void, OsStr};
use std::fs::File;
use std::io::{Read, Write};
use std::os::windows::ffi::OsStrExt;
use std::os::windows::io::{FromRawHandle, RawHandle};
use std::path::Path;
use std::ptr::{null, null_mut};
use std::thread;

use windows_sys::Win32::Foundation::{
    CloseHandle, GetLastError, HANDLE, INVALID_HANDLE_VALUE, WAIT_OBJECT_0, WAIT_TIMEOUT,
};
use windows_sys::Win32::Security::SECURITY_ATTRIBUTES;
use windows_sys::Win32::System::Console::{
    ClosePseudoConsole, CreatePseudoConsole, ResizePseudoConsole, COORD, HPCON,
};
use windows_sys::Win32::System::Pipes::CreatePipe;
use windows_sys::Win32::System::Threading::{
    CreateProcessW, DeleteProcThreadAttributeList, GetExitCodeProcess,
    InitializeProcThreadAttributeList, TerminateProcess, UpdateProcThreadAttribute,
    WaitForSingleObject, CREATE_UNICODE_ENVIRONMENT, EXTENDED_STARTUPINFO_PRESENT,
    LPPROC_THREAD_ATTRIBUTE_LIST, PROCESS_INFORMATION, PROC_THREAD_ATTRIBUTE_PSEUDOCONSOLE,
    STARTUPINFOEXW, STARTUPINFOW,
};

use crate::terminal_pty::{SharedOutputBuffer, TerminalPtySize};

const TERMINAL_READ_BUFFER_BYTES: usize = 4096;
const KILL_WAIT_MS: u32 = 2_000;

pub(crate) struct TerminalPtyPlatformSession {
    hpc: Option<isize>,
    process_handle: Option<usize>,
    pty_input_read: Option<usize>,
    pty_output_write: Option<usize>,
    input_writer: Option<File>,
    output_reader: Option<thread::JoinHandle<()>>,
}

impl TerminalPtyPlatformSession {
    pub(crate) fn start(
        shell: &str,
        shell_args: &[String],
        working_directory: &Path,
        size: TerminalPtySize,
        output: SharedOutputBuffer,
    ) -> Result<Self, String> {
        let input_pipe = create_pipe_pair("PTY input")?;
        let output_pipe = create_pipe_pair("PTY output")?;
        let hpc = match create_pseudoconsole(size, input_pipe.read_handle, output_pipe.write_handle)
        {
            Ok(hpc) => hpc,
            Err(error) => {
                input_pipe.close_all();
                output_pipe.close_all();
                return Err(error);
            }
        };

        let pty_input_read = input_pipe.read_handle as usize;
        let pty_output_write = output_pipe.write_handle as usize;
        let input_writer = unsafe { File::from_raw_handle(input_pipe.write_handle as RawHandle) };
        let output_reader_file =
            unsafe { File::from_raw_handle(output_pipe.read_handle as RawHandle) };

        let process = match spawn_attached_process(shell, shell_args, working_directory, hpc) {
            Ok(process) => process,
            Err(error) => {
                unsafe {
                    ClosePseudoConsole(hpc);
                }
                close_handle_if_valid(pty_input_read as HANDLE);
                close_handle_if_valid(pty_output_write as HANDLE);
                return Err(error);
            }
        };
        close_handle_if_valid(process.hThread);

        let output_reader = thread::spawn(move || read_output_loop(output_reader_file, output));

        Ok(Self {
            hpc: Some(hpc as isize),
            process_handle: Some(process.hProcess as usize),
            pty_input_read: Some(pty_input_read),
            pty_output_write: Some(pty_output_write),
            input_writer: Some(input_writer),
            output_reader: Some(output_reader),
        })
    }

    pub(crate) fn write_stdin(&mut self, bytes: &[u8]) -> Result<(), String> {
        let Some(writer) = self.input_writer.as_mut() else {
            return Err("terminal PTY input is closed".to_owned());
        };

        writer
            .write_all(bytes)
            .map_err(|error| format!("could not write terminal PTY stdin: {error}"))?;
        writer
            .flush()
            .map_err(|error| format!("could not flush terminal PTY stdin: {error}"))
    }

    pub(crate) fn resize(&mut self, size: TerminalPtySize) -> Result<(), String> {
        let Some(hpc) = self.hpc else {
            return Err("terminal PTY console is closed".to_owned());
        };

        let result = unsafe { ResizePseudoConsole(hpc as HPCON, coord(size)) };
        if result < 0 {
            return Err(format!(
                "could not resize terminal PTY: HRESULT 0x{:08X}",
                result as u32
            ));
        }

        Ok(())
    }

    pub(crate) fn kill(&mut self) -> Result<(), String> {
        let Some(process_handle) = self.process_handle else {
            return Ok(());
        };

        let process = process_handle as HANDLE;
        let terminated = unsafe { TerminateProcess(process, 1) };
        if terminated == 0 {
            return Err(format!(
                "could not force terminate terminal PTY process: {}",
                last_os_error_message()
            ));
        }
        let _ = unsafe { WaitForSingleObject(process, KILL_WAIT_MS) };
        Ok(())
    }

    pub(crate) fn try_exit_code(&mut self) -> Result<Option<i32>, String> {
        let Some(process_handle) = self.process_handle else {
            return Ok(None);
        };

        let process = process_handle as HANDLE;
        match unsafe { WaitForSingleObject(process, 0) } {
            WAIT_OBJECT_0 => {
                let mut exit_code = 0_u32;
                let ok = unsafe { GetExitCodeProcess(process, &mut exit_code) };
                if ok == 0 {
                    return Err(format!(
                        "could not inspect terminal PTY process exit code: {}",
                        last_os_error_message()
                    ));
                }
                Ok(Some(exit_code as i32))
            }
            WAIT_TIMEOUT => Ok(None),
            other => Err(format!(
                "could not inspect terminal PTY process state: wait status {other}"
            )),
        }
    }

    pub(crate) fn close_runtime_resources(&mut self) {
        self.input_writer.take();
        if let Some(hpc) = self.hpc.take() {
            unsafe {
                ClosePseudoConsole(hpc as HPCON);
            }
        }
        if let Some(input_read) = self.pty_input_read.take() {
            close_handle_if_valid(input_read as HANDLE);
        }
        if let Some(output_write) = self.pty_output_write.take() {
            close_handle_if_valid(output_write as HANDLE);
        }
        if let Some(process_handle) = self.process_handle.take() {
            close_handle_if_valid(process_handle as HANDLE);
        }
        if let Some(output_reader) = self.output_reader.take() {
            let _ = output_reader.join();
        }
    }
}

impl Drop for TerminalPtyPlatformSession {
    fn drop(&mut self) {
        self.close_runtime_resources();
    }
}

struct PipePair {
    read_handle: HANDLE,
    write_handle: HANDLE,
}

impl PipePair {
    fn close_all(self) {
        close_handle_if_valid(self.read_handle);
        close_handle_if_valid(self.write_handle);
    }
}

fn create_pipe_pair(label: &str) -> Result<PipePair, String> {
    let mut read_handle: HANDLE = null_mut();
    let mut write_handle: HANDLE = null_mut();
    let security_attributes = SECURITY_ATTRIBUTES {
        nLength: std::mem::size_of::<SECURITY_ATTRIBUTES>() as u32,
        lpSecurityDescriptor: null_mut(),
        bInheritHandle: 1,
    };
    let ok = unsafe { CreatePipe(&mut read_handle, &mut write_handle, &security_attributes, 0) };
    if ok == 0 {
        return Err(format!(
            "could not create {label} pipe: {}",
            last_os_error_message()
        ));
    }

    Ok(PipePair {
        read_handle,
        write_handle,
    })
}

fn create_pseudoconsole(
    size: TerminalPtySize,
    input_read: HANDLE,
    output_write: HANDLE,
) -> Result<HPCON, String> {
    let mut hpc: HPCON = 0;
    let result = unsafe { CreatePseudoConsole(coord(size), input_read, output_write, 0, &mut hpc) };
    if result < 0 {
        return Err(format!(
            "could not create Windows ConPTY terminal: HRESULT 0x{:08X}",
            result as u32
        ));
    }

    Ok(hpc)
}

fn spawn_attached_process(
    shell: &str,
    shell_args: &[String],
    working_directory: &Path,
    hpc: HPCON,
) -> Result<PROCESS_INFORMATION, String> {
    let mut attribute_list_size = 0_usize;
    unsafe {
        InitializeProcThreadAttributeList(null_mut(), 1, 0, &mut attribute_list_size);
    }
    if attribute_list_size == 0 {
        return Err(format!(
            "could not size terminal PTY process attribute list: {}",
            last_os_error_message()
        ));
    }

    let mut attribute_list = vec![0_u8; attribute_list_size];
    let attribute_list_ptr = attribute_list.as_mut_ptr() as LPPROC_THREAD_ATTRIBUTE_LIST;
    let initialized = unsafe {
        InitializeProcThreadAttributeList(attribute_list_ptr, 1, 0, &mut attribute_list_size)
    };
    if initialized == 0 {
        return Err(format!(
            "could not initialize terminal PTY process attribute list: {}",
            last_os_error_message()
        ));
    }

    let update_result = unsafe {
        UpdateProcThreadAttribute(
            attribute_list_ptr,
            0,
            PROC_THREAD_ATTRIBUTE_PSEUDOCONSOLE as usize,
            hpc as *const c_void,
            std::mem::size_of::<HPCON>(),
            null_mut(),
            null(),
        )
    };
    if update_result == 0 {
        unsafe {
            DeleteProcThreadAttributeList(attribute_list_ptr);
        }
        return Err(format!(
            "could not attach terminal PTY to process attributes: {}",
            last_os_error_message()
        ));
    }

    let mut startup_info = STARTUPINFOEXW::default();
    startup_info.StartupInfo.cb = std::mem::size_of::<STARTUPINFOEXW>() as u32;
    startup_info.lpAttributeList = attribute_list_ptr;

    let mut command_line = wide_null(OsStr::new(&windows_command_line(shell, shell_args)));
    let working_directory_wide = wide_null(working_directory.as_os_str());
    let mut process = PROCESS_INFORMATION::default();

    let created = unsafe {
        CreateProcessW(
            null(),
            command_line.as_mut_ptr(),
            null(),
            null(),
            0,
            EXTENDED_STARTUPINFO_PRESENT | CREATE_UNICODE_ENVIRONMENT,
            null(),
            working_directory_wide.as_ptr(),
            &startup_info as *const STARTUPINFOEXW as *const STARTUPINFOW,
            &mut process,
        )
    };
    unsafe {
        DeleteProcThreadAttributeList(attribute_list_ptr);
    }

    if created == 0 {
        return Err(format!(
            "could not start terminal PTY shell `{shell}`: {}",
            last_os_error_message()
        ));
    }

    Ok(process)
}

fn read_output_loop(mut output_reader: File, output: SharedOutputBuffer) {
    let mut buffer = [0_u8; TERMINAL_READ_BUFFER_BYTES];
    loop {
        match output_reader.read(&mut buffer) {
            Ok(0) => break,
            Ok(read_count) => output.push_terminal_output(&buffer[..read_count]),
            Err(error) => {
                output.push_terminal_output(
                    format!("[hobit terminal PTY output read error: {error}]").as_bytes(),
                );
                break;
            }
        }
    }
}

fn coord(size: TerminalPtySize) -> COORD {
    COORD {
        X: size.cols as i16,
        Y: size.rows as i16,
    }
}

fn windows_command_line(program: &str, args: &[String]) -> String {
    std::iter::once(program.to_owned())
        .chain(args.iter().cloned())
        .map(|arg| quote_windows_arg(&arg))
        .collect::<Vec<_>>()
        .join(" ")
}

fn quote_windows_arg(arg: &str) -> String {
    if !arg.is_empty()
        && !arg
            .chars()
            .any(|character| character.is_whitespace() || character == '"')
    {
        return arg.to_owned();
    }

    let mut quoted = String::from("\"");
    let mut backslashes = 0;
    for character in arg.chars() {
        match character {
            '\\' => backslashes += 1,
            '"' => {
                quoted.push_str(&"\\".repeat(backslashes * 2 + 1));
                quoted.push('"');
                backslashes = 0;
            }
            _ => {
                quoted.push_str(&"\\".repeat(backslashes));
                backslashes = 0;
                quoted.push(character);
            }
        }
    }
    quoted.push_str(&"\\".repeat(backslashes * 2));
    quoted.push('"');
    quoted
}

fn wide_null(value: &OsStr) -> Vec<u16> {
    value.encode_wide().chain(Some(0)).collect()
}

fn close_handle_if_valid(handle: HANDLE) {
    if !handle.is_null() && handle != INVALID_HANDLE_VALUE {
        unsafe {
            CloseHandle(handle);
        }
    }
}

fn last_os_error_message() -> String {
    let error_code = unsafe { GetLastError() };
    format!(
        "{} (OS error {error_code})",
        std::io::Error::last_os_error()
    )
}
