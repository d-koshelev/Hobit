use std::io::{BufRead, BufReader, Read};
use std::sync::mpsc::Sender;
use std::thread::{self, JoinHandle};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(super) enum StreamKind {
    Stdout,
    Stderr,
}

pub(super) enum ReaderMessage {
    Line { stream: StreamKind, line: String },
    Error { stream: StreamKind, message: String },
    Done(StreamKind),
}

pub(super) fn spawn_line_reader<R>(
    stream: StreamKind,
    reader: R,
    sender: Sender<ReaderMessage>,
) -> JoinHandle<()>
where
    R: Read + Send + 'static,
{
    thread::spawn(move || read_stream_lines(stream, reader, sender))
}

fn read_stream_lines(stream: StreamKind, reader: impl Read, sender: Sender<ReaderMessage>) {
    let mut reader = BufReader::new(reader);
    let mut buffer = Vec::new();

    loop {
        buffer.clear();

        match reader.read_until(b'\n', &mut buffer) {
            Ok(0) => break,
            Ok(_) => {
                let line = String::from_utf8_lossy(&buffer).into_owned();
                if sender.send(ReaderMessage::Line { stream, line }).is_err() {
                    return;
                }
            }
            Err(error) => {
                let _ = sender.send(ReaderMessage::Error {
                    stream,
                    message: format!("could not read process output: {error}"),
                });
                break;
            }
        }
    }

    let _ = sender.send(ReaderMessage::Done(stream));
}

pub(super) fn join_line_reader(
    reader: JoinHandle<()>,
    stream: StreamKind,
    reader_error: &mut Option<String>,
) {
    if reader.join().is_err() {
        let stream_name = match stream {
            StreamKind::Stdout => "stdout",
            StreamKind::Stderr => "stderr",
        };
        *reader_error = Some(format!("process {stream_name} reader failed"));
    }
}

#[derive(Default)]
pub(super) struct CappedOutput {
    bytes: Vec<u8>,
    truncated: bool,
}

impl CappedOutput {
    pub(super) fn append(&mut self, text: &str, cap_bytes: usize) {
        let bytes = text.as_bytes();
        let remaining = cap_bytes.saturating_sub(self.bytes.len());

        if remaining > 0 {
            let stored_count = remaining.min(bytes.len());
            self.bytes.extend_from_slice(&bytes[..stored_count]);
        }

        if bytes.len() > remaining {
            self.truncated = true;
        }
    }

    pub(super) fn into_parts(self) -> (String, bool) {
        (
            String::from_utf8_lossy(&self.bytes).into_owned(),
            self.truncated,
        )
    }
}

pub(super) fn stream_event_line(line: &str) -> String {
    line.trim_end_matches(|character| character == '\r' || character == '\n')
        .to_owned()
}
