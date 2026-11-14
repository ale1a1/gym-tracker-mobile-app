import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
}

// Supabase + Google ids come from the phone app's .env.local (never committed)
val env = Properties().apply {
    val file = rootProject.file("../.env.local")
    if (file.exists()) file.readLines().filter { it.contains("=") && !it.trim().startsWith("#") }.forEach {
        setProperty(it.substringBefore("=").trim(), it.substringAfter("=").trim())
    }
}
fun envValue(key: String): String = env.getProperty(key) ?: error("$key missing from .env.local")

// Same permanent key as the phone app, so the same Google Android client works
val keyProps = Properties().apply {
    val file = file("C:/p/keys/gym-tracker-release.properties")
    if (file.exists()) file.inputStream().use { load(it) }
}

android {
    namespace = "com.alessandroladu.gymtracker.wear"
    compileSdk = 36

    defaultConfig {
        // Same application id as the phone app: Google sign-in and the Play Store pair them
        applicationId = "com.alessandroladu.gymtracker"
        minSdk = 30
        targetSdk = 36
        versionCode = 1
        versionName = "1.0.0"

        buildConfigField("String", "SUPABASE_URL", "\"${envValue("EXPO_PUBLIC_SUPABASE_URL")}\"")
        buildConfigField("String", "SUPABASE_ANON_KEY", "\"${envValue("EXPO_PUBLIC_SUPABASE_ANON_KEY")}\"")
        buildConfigField("String", "GOOGLE_WEB_CLIENT_ID", "\"${envValue("EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID")}\"")
    }

    signingConfigs {
        create("release") {
            if (keyProps.isEmpty) error("Release key not found at C:/p/keys/gym-tracker-release.properties")
            storeFile = file(keyProps.getProperty("GYMTRACKER_RELEASE_STORE_FILE"))
            storePassword = keyProps.getProperty("GYMTRACKER_RELEASE_STORE_PASSWORD")
            keyAlias = keyProps.getProperty("GYMTRACKER_RELEASE_KEY_ALIAS")
            keyPassword = keyProps.getProperty("GYMTRACKER_RELEASE_KEY_PASSWORD")
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("release")
        }
        debug {
            // Debug also uses the release key so Google sign-in works while testing
            signingConfig = signingConfigs.getByName("release")
        }
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    // Wear OS Compose
    implementation("androidx.wear.compose:compose-material3:1.5.0")
    implementation("androidx.wear.compose:compose-foundation:1.5.0")
    implementation("androidx.wear.compose:compose-navigation:1.5.0")
    implementation("androidx.activity:activity-compose:1.10.1")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.9.2")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.9.2")
    implementation("androidx.compose.material:material-icons-core:1.7.8")

    // Google sign-in (Credential Manager)
    implementation("androidx.credentials:credentials:1.5.0")
    implementation("androidx.credentials:credentials-play-services-auth:1.5.0")
    implementation("com.google.android.libraries.identity.googleid:googleid:1.1.1")

    // Supabase
    implementation(platform("io.github.jan-tennert.supabase:bom:3.2.2"))
    implementation("io.github.jan-tennert.supabase:auth-kt")
    implementation("io.github.jan-tennert.supabase:postgrest-kt")
    implementation("io.ktor:ktor-client-okhttp:3.2.3")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.9.0")
}
