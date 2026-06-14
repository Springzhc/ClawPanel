package update

import (
	"fmt"
	"runtime"
	"strings"
)

type editionConfig struct {
	Edition           string
	ServiceName       string
	BinaryName        string
	GitHubReleasesAPI string
	GitHubTagPrefix   string
}

func newEditionConfig(edition string) editionConfig {
	_ = edition
	return editionConfig{
		Edition:           "pro",
		ServiceName:       "clawpanel",
		BinaryName:        "clawpanel",
		GitHubReleasesAPI: "https://api.github.com/repos/Springzhc/ClawPanel/releases?per_page=20",
		GitHubTagPrefix:   "pro-v",
	}
}

func (c editionConfig) matchesTag(tag string) bool {
	return strings.HasPrefix(strings.TrimSpace(tag), c.GitHubTagPrefix)
}

func (c editionConfig) trimTag(tag string) string {
	return strings.TrimPrefix(strings.TrimSpace(tag), c.GitHubTagPrefix)
}

func (c editionConfig) assetPrefix(version string) string {
	return fmt.Sprintf("clawpanel-v%s", version)
}

func (c editionConfig) isLiteFullPackage() bool {
	return false
}

func (c editionConfig) binaryAssetName(version, platformKey string) string {
	prefix := "clawpanel"
	name := fmt.Sprintf("%s-v%s-%s", prefix, version, strings.ReplaceAll(platformKey, "_", "-"))
	if runtime.GOOS == "windows" || strings.HasPrefix(platformKey, "windows_") {
		name += ".exe"
	}
	return name
}

func (c editionConfig) updateAssetName(version, platformKey string) string {
	return c.binaryAssetName(version, platformKey)
}

func (c editionConfig) matchUpdateAsset(version string, releaseAssetName string) (string, bool) {
	assetName := strings.TrimSpace(releaseAssetName)
	for _, platformKey := range []string{"linux_amd64", "linux_arm64", "darwin_amd64", "darwin_arm64", "windows_amd64"} {
		if expected := c.updateAssetName(version, platformKey); expected != "" && assetName == expected {
			return platformKey, true
		}
	}
	return "", false
}
