package buildinfo

var (
	Version = "5.5.2s"
	Edition = "pro"
)

func NormalizedEdition() string {
	return "pro"
}

func IsLite() bool {
	return false
}
