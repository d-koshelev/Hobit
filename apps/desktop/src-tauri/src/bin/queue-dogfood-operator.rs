fn main() {
    let exit_code = match hobit_desktop::dogfood_operator::run_cli(std::env::args().skip(1)) {
        Ok(()) => 0,
        Err(error) => {
            eprintln!("ERROR: {error}");
            2
        }
    };
    std::process::exit(exit_code);
}
