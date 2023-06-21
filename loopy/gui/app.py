import os
import sys
import threading
from pathlib import Path

from PyQt5 import QtCore, QtGui, QtWidgets
from PyQt5.QtWidgets import (
    QApplication,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QMessageBox,
    QPushButton,
    QVBoxLayout,
    QWidget,
)

from loopy.drivers.spaceranger import run_spaceranger

if getattr(sys, "frozen", False) and sys.platform == "win32":
    os.environ["PROJ_DATA"] = sys._MEIPASS + "/projdata"
    os.environ["GDAL_DATA"] = sys._MEIPASS + "/gdaldata"
    print("GDAL_DATA", os.environ["GDAL_DATA"])

from loopy.sample import Sample


class FileEdit(QLineEdit):
    def __init__(self, parent: QWidget | None = None):
        super().__init__(parent)
        self.setDragEnabled(True)

    def dragEnterEvent(self, a0: QtGui.QDropEvent):
        data = a0.mimeData()
        urls = data.urls()
        if urls and urls[0].scheme() == "file":
            a0.acceptProposedAction()

    def dragMoveEvent(self, e: QtGui.QDragMoveEvent):
        data = e.mimeData()
        urls = data.urls()
        if urls and urls[0].scheme() == "file":
            e.acceptProposedAction()

    def dropEvent(self, a0: QtGui.QDropEvent):
        urls = a0.mimeData().urls()
        path = Path(urls[0].toLocalFile())
        if path.suffix in [".tif", ".tiff"]:
            self.setText(path.as_posix())
        else:
            QMessageBox.warning(self, "Invalid file", "Only TIFF files are supported.")


class FileBoxLine(QWidget):
    def __init__(
        self,
        label: str,
        parent: QWidget | None = None,
        folderOnly: bool = False,
        extensions: str | None = None,
    ):
        super().__init__(parent)
        self.folderOnly = folderOnly
        self.extensions = extensions

        self.label = QLabel(label)
        self.file_edit = FileEdit()
        self.button = QPushButton("Browse")
        self.button.clicked.connect(self.browse)
        layout = QHBoxLayout()
        layout.addWidget(self.label)
        layout.addWidget(self.file_edit)
        layout.addWidget(self.button)
        self.setLayout(layout)

    def browse(self):
        if self.folderOnly:
            path = QtWidgets.QFileDialog.getExistingDirectory(self, "Open Directory")
        else:
            path, _ = QtWidgets.QFileDialog.getOpenFileName(
                self, "Open File", "", self.extensions if self.extensions else ""
            )
        if path:
            self.file_edit.setText(path)


class TextLine(QWidget):
    def __init__(
        self,
        parent: QWidget | None = None,
        label: str | None = None,
        default: str | None = None,
        numbersOnly: bool = False,
        alphanumeric: bool = False,
    ):
        super().__init__(parent)
        layout = QHBoxLayout()
        self.label = QLabel(label)
        self.text = QLineEdit()

        if default:
            self.text.setText(default)

        if numbersOnly:
            self.text.setValidator(QtGui.QDoubleValidator())

        if alphanumeric:
            self.text.setValidator(QtGui.QRegExpValidator(QtCore.QRegExp("[a-zA-Z0-9_,]*")))

        layout.addWidget(self.label)
        layout.addWidget(self.text)
        self.setLayout(layout)


# status bar class
class StatusBar(QtWidgets.QStatusBar):
    def __init__(self, parent: QWidget | None = None):
        super().__init__(parent)
        self.showMessage("Ready")

    def updateStatus(self, message: str):
        self.showMessage(message)


class MainWindow(QWidget):
    valueChanged = QtCore.pyqtSignal(int)

    def __init__(self):
        super().__init__()
        self.initUI()

    def initUI(self):
        self.setWindowTitle("Samui Preprocessor")
        self.setGeometry(300, 300, 600, 200)

        self.label = QLabel(
            "You can browse for your spaceranger output folder or your TIFF file or both (to overlay TIFF file on top of the spaceranger result)."
        )
        self.spaceranger = FileBoxLine("spaceranger output:", folderOnly=True)
        self.tiff = FileBoxLine("TIFF file:", extensions="TIFF Files (*.tif *.tiff)")
        self.out = FileBoxLine("Out directory", folderOnly=True)
        self.channels = TextLine(label="Channel names\n(separated by commas, no spaces)", alphanumeric=True)
        self.quality = TextLine(label="Compression quality:", default="95", numbersOnly=True)
        self.scale = TextLine(label="Scale (in meters/px)", default="1.0", numbersOnly=True)
        self.statusBar = StatusBar(self)

        self.runButton = QPushButton("Run")
        self.runButton.clicked.connect(self.run)

        layout = QVBoxLayout()
        layout.addWidget(self.label)
        layout.addWidget(self.spaceranger)
        layout.addWidget(self.tiff)
        layout.addWidget(self.out)
        layout.addWidget(self.channels)
        layout.addWidget(self.quality)
        layout.addWidget(self.scale)
        layout.addWidget(self.runButton)
        layout.addWidget(self.statusBar)

        self.setLayout(layout)

    @QtCore.pyqtSlot()
    def run(self):
        spaceranger = self.spaceranger.file_edit.text()
        tiff = self.tiff.file_edit.text()
        out = self.out.file_edit.text()
        channels = self.channels.text.text()
        quality = self.quality.text.text()
        scale = self.scale.text.text()
        if not tiff and not spaceranger:
            QMessageBox.warning(
                self, "No file/directory", "Please select a TIFF file or a spaceranger output directory."
            )
            return
        if not out:
            QMessageBox.warning(self, "No directory", "Please select an output directory.")
            return
        if not quality:
            QMessageBox.warning(self, "No quality", "Please enter a quality.")
            return
        if not scale:
            QMessageBox.warning(self, "No scale", "Please enter a scale.")
            return

        def really_run():
            # Gray out the run button
            self.runButton.setEnabled(False)
            self.statusBar.updateStatus("Running...")
            outpath = Path(out) / Path(tiff).stem
            outpath.mkdir(parents=True, exist_ok=True)

            sample = Sample(name=Path(tiff).stem, path=outpath)

            if spaceranger:
                sample = run_spaceranger(
                    Path(spaceranger).name,
                    Path(spaceranger).parent,
                    outpath,
                    tif=tiff if tiff else None,
                    channels=channels.split(",") if channels else None,
                )

            if tiff:
                sample.add_image(
                    tiff, channels=channels if channels else None, scale=float(scale), quality=int(quality)
                )

            sample.write()

            self.statusBar.updateStatus("Ready.")
            self.runButton.setEnabled(True)

        threading.Thread(target=really_run, daemon=True).start()


def main():
    app = QApplication(sys.argv)
    ex = MainWindow()
    ex.show()
    app.exec_()


if __name__ == "__main__":
    main()
    main()
    main()
    main()
