# CocoaPods recipe for the app's only native module. Autolinking finds it via
# ../expo-module.config.json, so there is nothing to add to package.json.
Pod::Spec.new do |s|
  s.name           = 'DioramaNative'
  s.version        = '0.1.0'
  s.summary        = 'Diorama native map view (MapKit)'
  s.description    = 'MapKit-backed DioramaMapView for the Diorama app.'
  s.author         = 'Evan Freymiller'
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.license        = 'MIT'
  s.platforms      = {
    :ios => '16.4'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'MapKit', 'QuartzCore', 'CoreMotion'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
