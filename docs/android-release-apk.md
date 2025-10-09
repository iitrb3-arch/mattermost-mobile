# Building a lightweight release APK

To generate a small, production-ready APK that can be uploaded to marketplaces such as Bazaar, follow the steps below. These steps assume you have already configured the project for the Andisheh Hosseini deployment.

1. **Install dependencies**
   ```bash
   npm install
   cd android
   ./gradlew clean
   ```

2. **Set up signing (optional)**
   Place your keystore credentials in the environment before building to sign the release output:
   ```bash
   export MATTERMOST_RELEASE_STORE_FILE=/path/to/keystore.jks
   export MATTERMOST_RELEASE_KEY_ALIAS=your_alias
   export MATTERMOST_RELEASE_PASSWORD=your_password
   ```

3. **Assemble the release APK**
   ```bash
   ./gradlew assembleRelease
   ```

4. **Locate the APK**
   The optimized APK will be placed in:
   ```
   android/app/build/outputs/apk/release/app-release.apk
   ```

The Gradle configuration enables code and resource shrinking, and limits packaged locales to Persian and English, ensuring that the resulting APK stays as small as possible while remaining compatible across Android devices.
