// Signs release builds with the permanent key in C:/p/keys (kept outside the repo and backed up).
// Runs on every `expo prebuild`, so a prebuild --clean can't silently fall back to the debug key.
// If the key file is missing (e.g. another machine), the build fails instead of using the debug key,
// because a debug-signed APK can't update the installed app and breaks Google sign-in.
const { withAppBuildGradle } = require("expo/config-plugins")

const KEY_PROPERTIES = "C:/p/keys/gym-tracker-release.properties"
const MARKER = "// gym-tracker release signing"

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (config) => {
    let gradle = config.modResults.contents
    if (gradle.includes(MARKER)) return config

    gradle = gradle.replace(
      /signingConfigs \{\n/,
      `signingConfigs {
        ${MARKER}
        release {
            def keyProps = new Properties()
            def keyPropsFile = file('${KEY_PROPERTIES}')
            if (!keyPropsFile.exists()) {
                throw new GradleException("Release key not found at ${KEY_PROPERTIES}. Restore it from the backup.")
            }
            keyPropsFile.withInputStream { keyProps.load(it) }
            storeFile file(keyProps['GYMTRACKER_RELEASE_STORE_FILE'])
            storePassword keyProps['GYMTRACKER_RELEASE_STORE_PASSWORD']
            keyAlias keyProps['GYMTRACKER_RELEASE_KEY_ALIAS']
            keyPassword keyProps['GYMTRACKER_RELEASE_KEY_PASSWORD']
        }
`,
    )

    // Point the release build type at it (the debug build type keeps the debug key)
    gradle = gradle.replace(
      /(release \{\n(?:\s*\/\/.*\n)*\s*)signingConfig signingConfigs\.debug/,
      "$1signingConfig signingConfigs.release",
    )

    config.modResults.contents = gradle
    return config
  })
}
