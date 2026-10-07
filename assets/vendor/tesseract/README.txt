Text recognition (OCR) for reading photos and scans of a CV, run entirely in the visitor's browser.
Nothing is sent to any server: these files are served from this site and the picture never leaves the device.

tesseract.min.js, worker.min.js   tesseract.js 7.0.0        Apache License 2.0 (LICENSE-tesseract.js.txt)
core/*.wasm.js                    tesseract.js-core 7.0.0   Apache License 2.0 (LICENSE-tesseract-core.txt)
lang/eng.traineddata.gz           @tesseract.js-data/eng 1.0.0 (Tesseract "4.0.0_best_int" English model,
                                  from github.com/tesseract-ocr/tessdata_best_int, Apache License 2.0)
Small libraries bundled inside the two main files are listed in LICENSE-bundled-parts.txt (MIT and BSD).

Source-map comments were removed from the .js files; nothing else was changed.
