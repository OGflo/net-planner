import UIKit
import Vision
import PhotosUI
import UniformTypeIdentifiers
#if !targetEnvironment(macCatalyst)
import VisionKit
#endif

/// Reads labels: live camera (text + barcodes) on iPhone/iPad, or a photo/image file anywhere (Mac, simulator).
/// Returns every line of text and every barcode payload it finds.
@MainActor
final class Scanner: NSObject {
    private var continuation: CheckedContinuation<[String], Error>?
    private var picked: [String] = []
    private var live: [String] = []
    #if !targetEnvironment(macCatalyst)
    private weak var titleItem: UINavigationItem?
    #endif

    func scan(from presenter: UIViewController, anchor: UIView) async throws -> [String] {
        if continuation != nil { throw BridgeError("A scan is already open") }
        return try await withCheckedThrowingContinuation { cont in
            continuation = cont
            picked = []; live = []
            #if !targetEnvironment(macCatalyst)
            if DataScannerViewController.isSupported && DataScannerViewController.isAvailable {
                presentLiveScanner(from: presenter)
                return
            }
            #endif
            presentSourceChooser(from: presenter, anchor: anchor)
        }
    }

    private func finish(_ result: Result<[String], Error>) {
        guard let c = continuation else { return }
        continuation = nil
        c.resume(with: result)
    }

    // MARK: live camera (VisionKit)
    #if !targetEnvironment(macCatalyst)
    private func presentLiveScanner(from presenter: UIViewController) {
        let vc = DataScannerViewController(recognizedDataTypes: [.text(), .barcode()], qualityLevel: .accurate,
                                           recognizesMultipleItems: true, isHighFrameRateTrackingEnabled: false,
                                           isPinchToZoomEnabled: true, isGuidanceEnabled: true, isHighlightingEnabled: true)
        vc.delegate = self
        vc.navigationItem.title = "Point at the label · tap lines to pick"
        vc.navigationItem.leftBarButtonItem = UIBarButtonItem(systemItem: .cancel, primaryAction: UIAction { [weak self] _ in
            presenter.dismiss(animated: true) { self?.finish(.failure(BridgeError("cancelled"))) }
        })
        vc.navigationItem.rightBarButtonItem = UIBarButtonItem(title: "Use", primaryAction: UIAction { [weak self] _ in
            guard let self else { return }
            let result = self.picked.isEmpty ? self.live : self.picked
            presenter.dismiss(animated: true) { self.finish(.success(result)) }
        })
        titleItem = vc.navigationItem
        let nav = UINavigationController(rootViewController: vc)
        nav.modalPresentationStyle = .fullScreen
        presenter.present(nav, animated: true) { try? vc.startScanning() }
    }
    #endif

    // MARK: photo / file (Mac, simulator, devices without the live scanner)
    private func presentSourceChooser(from presenter: UIViewController, anchor: UIView) {
        let sheet = UIAlertController(title: "Read a label", message: "Take or choose a photo of the label. Text and barcodes are read on this device.", preferredStyle: .actionSheet)
        if UIImagePickerController.isSourceTypeAvailable(.camera) {
            sheet.addAction(UIAlertAction(title: "Take Photo", style: .default) { [weak self] _ in self?.after { $0.presentCamera(from: presenter) } })
        }
        sheet.addAction(UIAlertAction(title: "Choose Photo", style: .default) { [weak self] _ in self?.after { $0.presentPhotoPicker(from: presenter) } })
        sheet.addAction(UIAlertAction(title: "Choose Image File", style: .default) { [weak self] _ in self?.after { $0.presentFilePicker(from: presenter) } })
        sheet.addAction(UIAlertAction(title: "Cancel", style: .cancel) { [weak self] _ in self?.finish(.failure(BridgeError("cancelled"))) })
        if let pop = sheet.popoverPresentationController {
            pop.sourceView = anchor
            pop.sourceRect = CGRect(x: anchor.bounds.midX, y: anchor.bounds.midY, width: 1, height: 1)
            pop.permittedArrowDirections = []
        }
        presenter.present(sheet, animated: true)
    }

    /// Present the next screen only once the action sheet has finished closing.
    private func after(_ step: @escaping (Scanner) -> Void) {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.45) { [weak self] in
            guard let self else { return }
            step(self)
        }
    }

    private func presentCamera(from presenter: UIViewController) {
        let p = UIImagePickerController()
        p.sourceType = .camera
        p.delegate = self
        p.presentationController?.delegate = self
        presenter.present(p, animated: true)
    }

    private func presentPhotoPicker(from presenter: UIViewController) {
        var cfg = PHPickerConfiguration()
        cfg.filter = .images
        cfg.selectionLimit = 1
        let p = PHPickerViewController(configuration: cfg)
        p.delegate = self
        presenter.present(p, animated: true)
    }

    private func presentFilePicker(from presenter: UIViewController) {
        let p = UIDocumentPickerViewController(forOpeningContentTypes: [.image], asCopy: true)
        p.delegate = self
        presenter.present(p, animated: true)
    }

    fileprivate func read(_ image: UIImage?) {
        guard let image, let cg = image.cgImage else { finish(.failure(BridgeError("Could not read that image"))); return }
        let orientation = CGImagePropertyOrientation(image.imageOrientation)
        Task.detached(priority: .userInitiated) {
            let lines = Scanner.recognize(cg, orientation: orientation)
            await MainActor.run { self.finish(.success(lines)) }
        }
    }

    nonisolated static func recognize(_ cg: CGImage, orientation: CGImagePropertyOrientation) -> [String] {
        let text = VNRecognizeTextRequest()
        text.recognitionLevel = .accurate
        text.usesLanguageCorrection = false
        let codes = VNDetectBarcodesRequest()
        try? VNImageRequestHandler(cgImage: cg, orientation: orientation).perform([text, codes])
        let barcodes = (codes.results ?? []).compactMap { $0.payloadStringValue }
        let lines = (text.results ?? []).compactMap { $0.topCandidates(1).first?.string }
        var seen = Set<String>()
        return (barcodes + lines).filter { seen.insert($0).inserted }
    }
}

#if !targetEnvironment(macCatalyst)
extension Scanner: DataScannerViewControllerDelegate {
    private func string(_ item: RecognizedItem) -> String? {
        switch item {
        case .text(let t): return t.transcript
        case .barcode(let b): return b.payloadStringValue
        @unknown default: return nil
        }
    }
    nonisolated func dataScanner(_ dataScanner: DataScannerViewController, didTapOn item: RecognizedItem) {
        MainActor.assumeIsolated {
            guard let s = string(item), !picked.contains(s) else { return }
            picked.append(s)
            titleItem?.title = "\(picked.count) picked · tap Use when done"
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
        }
    }
    nonisolated func dataScanner(_ dataScanner: DataScannerViewController, didUpdate updatedItems: [RecognizedItem], allItems: [RecognizedItem]) {
        MainActor.assumeIsolated { live = allItems.compactMap { string($0) } }
    }
    nonisolated func dataScanner(_ dataScanner: DataScannerViewController, didAdd addedItems: [RecognizedItem], allItems: [RecognizedItem]) {
        MainActor.assumeIsolated { live = allItems.compactMap { string($0) } }
    }
}
#endif

extension Scanner: UIImagePickerControllerDelegate, UINavigationControllerDelegate {
    nonisolated func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
        MainActor.assumeIsolated {
            let img = info[.originalImage] as? UIImage
            picker.dismiss(animated: true) { self.read(img) }
        }
    }
    nonisolated func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
        MainActor.assumeIsolated { picker.dismiss(animated: true) { self.finish(.failure(BridgeError("cancelled"))) } }
    }
}

extension Scanner: PHPickerViewControllerDelegate {
    nonisolated func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
        MainActor.assumeIsolated {
            picker.dismiss(animated: true)
            guard let provider = results.first?.itemProvider, provider.canLoadObject(ofClass: UIImage.self) else {
                finish(.failure(BridgeError("cancelled"))); return
            }
            provider.loadObject(ofClass: UIImage.self) { obj, _ in
                let img = obj as? UIImage
                Task { @MainActor in self.read(img) }
            }
        }
    }
}

extension Scanner: UIDocumentPickerDelegate {
    nonisolated func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        MainActor.assumeIsolated {
            let img = urls.first.flatMap { try? Data(contentsOf: $0) }.flatMap { UIImage(data: $0) }
            read(img)
        }
    }
    nonisolated func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        MainActor.assumeIsolated { finish(.failure(BridgeError("cancelled"))) }
    }
}

extension Scanner: UIAdaptivePresentationControllerDelegate {
    nonisolated func presentationControllerDidDismiss(_ presentationController: UIPresentationController) {
        MainActor.assumeIsolated { finish(.failure(BridgeError("cancelled"))) }
    }
}

extension CGImagePropertyOrientation {
    init(_ o: UIImage.Orientation) {
        switch o {
        case .up: self = .up
        case .down: self = .down
        case .left: self = .left
        case .right: self = .right
        case .upMirrored: self = .upMirrored
        case .downMirrored: self = .downMirrored
        case .leftMirrored: self = .leftMirrored
        case .rightMirrored: self = .rightMirrored
        @unknown default: self = .up
        }
    }
}
