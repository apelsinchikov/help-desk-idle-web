import SwiftUI
import UIKit

/// Единственная точка доступа к иконкам. Смена пака = новые картинки `<pack>_<iconKey>` + смена `pack`.
enum IconProvider {
    static var pack = "fluent3d"

    static func image(for iconKey: String) -> Image {
        let name = "\(pack)_\(iconKey)"
        if UIImage(named: name) != nil {
            return Image(name)
        }
        return Image(systemName: "questionmark.square.dashed")
    }
}
