pub(super) fn parse_lightweight_json_line(line: &str) -> Option<String> {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return None;
    }

    let mut parser = JsonParser::new(trimmed);
    if parser.parse_value() && parser.is_finished() {
        Some(trimmed.to_owned())
    } else {
        None
    }
}

struct JsonParser<'a> {
    input: &'a [u8],
    index: usize,
}

impl<'a> JsonParser<'a> {
    fn new(input: &'a str) -> Self {
        Self {
            input: input.as_bytes(),
            index: 0,
        }
    }

    fn parse_value(&mut self) -> bool {
        self.skip_whitespace();

        match self.peek() {
            Some(b'{') => self.parse_object(),
            Some(b'[') => self.parse_array(),
            Some(b'"') => self.parse_string(),
            Some(b'-' | b'0'..=b'9') => self.parse_number(),
            Some(b't') => self.consume_literal(b"true"),
            Some(b'f') => self.consume_literal(b"false"),
            Some(b'n') => self.consume_literal(b"null"),
            _ => false,
        }
    }

    fn parse_object(&mut self) -> bool {
        if !self.consume_byte(b'{') {
            return false;
        }
        self.skip_whitespace();

        if self.consume_byte(b'}') {
            return true;
        }

        loop {
            self.skip_whitespace();
            if !self.parse_string() {
                return false;
            }
            self.skip_whitespace();
            if !self.consume_byte(b':') {
                return false;
            }
            if !self.parse_value() {
                return false;
            }
            self.skip_whitespace();

            if self.consume_byte(b'}') {
                return true;
            }
            if !self.consume_byte(b',') {
                return false;
            }
        }
    }

    fn parse_array(&mut self) -> bool {
        if !self.consume_byte(b'[') {
            return false;
        }
        self.skip_whitespace();

        if self.consume_byte(b']') {
            return true;
        }

        loop {
            if !self.parse_value() {
                return false;
            }
            self.skip_whitespace();

            if self.consume_byte(b']') {
                return true;
            }
            if !self.consume_byte(b',') {
                return false;
            }
        }
    }

    fn parse_string(&mut self) -> bool {
        if !self.consume_byte(b'"') {
            return false;
        }

        while let Some(byte) = self.next_byte() {
            match byte {
                b'"' => return true,
                b'\\' => {
                    if !self.parse_escape() {
                        return false;
                    }
                }
                0x00..=0x1f => return false,
                _ => {}
            }
        }

        false
    }

    fn parse_escape(&mut self) -> bool {
        match self.next_byte() {
            Some(b'"' | b'\\' | b'/' | b'b' | b'f' | b'n' | b'r' | b't') => true,
            Some(b'u') => {
                (0..4).all(|_| matches!(self.next_byte(), Some(byte) if byte.is_ascii_hexdigit()))
            }
            _ => false,
        }
    }

    fn parse_number(&mut self) -> bool {
        if self.peek() == Some(b'-') {
            self.index += 1;
        }

        match self.peek() {
            Some(b'0') => self.index += 1,
            Some(b'1'..=b'9') => {
                self.index += 1;
                while matches!(self.peek(), Some(b'0'..=b'9')) {
                    self.index += 1;
                }
            }
            _ => return false,
        }

        if self.peek() == Some(b'.') {
            self.index += 1;
            if !matches!(self.peek(), Some(b'0'..=b'9')) {
                return false;
            }
            while matches!(self.peek(), Some(b'0'..=b'9')) {
                self.index += 1;
            }
        }

        if matches!(self.peek(), Some(b'e' | b'E')) {
            self.index += 1;
            if matches!(self.peek(), Some(b'+' | b'-')) {
                self.index += 1;
            }
            if !matches!(self.peek(), Some(b'0'..=b'9')) {
                return false;
            }
            while matches!(self.peek(), Some(b'0'..=b'9')) {
                self.index += 1;
            }
        }

        true
    }

    fn consume_literal(&mut self, literal: &[u8]) -> bool {
        if self.input[self.index..].starts_with(literal) {
            self.index += literal.len();
            true
        } else {
            false
        }
    }

    fn is_finished(&mut self) -> bool {
        self.skip_whitespace();
        self.index == self.input.len()
    }

    fn skip_whitespace(&mut self) {
        while matches!(self.peek(), Some(b' ' | b'\n' | b'\r' | b'\t')) {
            self.index += 1;
        }
    }

    fn consume_byte(&mut self, expected: u8) -> bool {
        if self.peek() == Some(expected) {
            self.index += 1;
            true
        } else {
            false
        }
    }

    fn next_byte(&mut self) -> Option<u8> {
        let byte = self.peek()?;
        self.index += 1;
        Some(byte)
    }

    fn peek(&self) -> Option<u8> {
        self.input.get(self.index).copied()
    }
}
