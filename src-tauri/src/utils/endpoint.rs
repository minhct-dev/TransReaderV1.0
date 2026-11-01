/// Debug builds only: lets the E2E suite point an API at a local stub server by
/// setting `var`. Release builds always return `default`.
pub fn endpoint(var: &str, default: &str) -> String {
    if cfg!(debug_assertions)
        && let Ok(url) = std::env::var(var)
        && !url.trim().is_empty()
    {
        return url;
    }
    default.to_string()
}

#[cfg(test)]
mod tests {
    use super::endpoint;

    #[test]
    fn falls_back_to_the_default_when_the_variable_is_unset() {
        assert_eq!(
            endpoint("TRANSREADER_TEST_UNSET_VARIABLE", "https://example.com"),
            "https://example.com"
        );
    }
}