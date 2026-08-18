import ExpoModulesCore

public class DhebuNotificationsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("DhebuNotifications")

    Events("onChange")

    AsyncFunction("setValueAsync") { (value: String) in
      self.sendEvent("onChange", [
        "value": value
      ])
    }
  }
}
