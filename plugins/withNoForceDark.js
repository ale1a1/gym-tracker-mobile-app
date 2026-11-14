// Stops Android from auto-darkening the app ("force dark" / expanded dark theme). The app has its
// own Light and Dark themes; without this, Light mode on a phone set to dark gets inverted
// (white cards turn black).
const { withAndroidStyles, AndroidConfig } = require("expo/config-plugins")

module.exports = function withNoForceDark(config) {
  return withAndroidStyles(config, (config) => {
    config.modResults = AndroidConfig.Styles.assignStylesValue(config.modResults, {
      add: true,
      parent: AndroidConfig.Styles.getAppThemeGroup(),
      name: "android:forceDarkAllowed",
      value: "false",
    })
    return config
  })
}
