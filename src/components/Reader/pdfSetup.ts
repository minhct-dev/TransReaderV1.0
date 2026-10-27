import { pdfjs } from "react-pdf";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import "./readerPdf.css";

// pdf.js parses each document in a worker. Passing it through Vite keeps the
// worker inside the bundle, so the reader never needs a CDN or a network.
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
