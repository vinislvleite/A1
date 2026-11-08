const fs = require('fs');
const path = require('path');

function patchFile(relPath, content) {
  const fullPath = path.join(__dirname, '..', relPath);
  if (fs.existsSync(path.dirname(fullPath))) {
    fs.writeFileSync(fullPath, content, 'utf8');
  }
}

patchFile(
  'node_modules/react-native-sqlite-storage/platforms/android/build.gradle',
  `buildscript {
    repositories {
        google()
        mavenCentral()
    }

    dependencies {
        classpath 'com.android.tools.build:gradle:8.0.0'
    }
}

apply plugin: 'com.android.library'

android {
    namespace "org.pgsqlite"
    compileSdkVersion safeExtGet('compileSdkVersion', 34)

    defaultConfig {
        minSdkVersion safeExtGet('minSdkVersion', 21)
        targetSdkVersion safeExtGet('targetSdkVersion', 34)
    }
}

repositories {
    google()
    mavenCentral()
}

dependencies {
    implementation 'com.facebook.react:react-native:+'
}

def safeExtGet(prop, fallback) {
    rootProject.ext.has(prop) ? rootProject.ext.get(prop) : fallback
}
`
);

patchFile(
  'node_modules/react-native-sqlite-storage/platforms/android/src/main/AndroidManifest.xml',
  `<manifest xmlns:android="http://schemas.android.com/apk/res/android">
</manifest>
`
);

patchFile(
  'node_modules/react-native-encrypted-storage/android/build.gradle',
  `buildscript {
    repositories {
        google()
        mavenCentral()
    }

    dependencies {
        classpath 'com.android.tools.build:gradle:8.0.0'
    }
}

apply plugin: 'com.android.library'

def safeExtGet(prop, fallback) {
    rootProject.ext.has(prop) ? rootProject.ext.get(prop) : fallback
}

android {
    namespace "com.emeraldsanto.encryptedstorage"
    compileSdkVersion safeExtGet('compileSdkVersion', 34)

    defaultConfig {
        minSdkVersion safeExtGet('minSdkVersion', 21)
        targetSdkVersion safeExtGet('targetSdkVersion', 34)
        versionCode 1
        versionName "1.0"
    }
    lintOptions {
        abortOnError false
    }
}

repositories {
    google()
    mavenCentral()
}

dependencies {
    implementation 'com.facebook.react:react-native:+'
    implementation "androidx.security:security-crypto:1.1.0-alpha06"
}
`
);

patchFile(
  'node_modules/react-native-encrypted-storage/android/src/main/AndroidManifest.xml',
  `<manifest xmlns:android="http://schemas.android.com/apk/res/android">
</manifest>
`
);
