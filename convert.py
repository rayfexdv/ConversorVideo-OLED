#!/usr/bin/env python3
"""
Conversor de Video / Imagen a XBM para OLED SH1106 / SSD1306 (U8g2)
Compatible con ESP32-S3 (16MB Flash / 8MB PSRAM)

Requisitos:
    pip install opencv-python pillow numpy

Uso:
    python convert.py video.mp4 --fps 10 --max-frames 80 --output frames.h
    python convert.py imagen.png --output imagen.h
"""

import os
import sys
import argparse
import numpy as np

try:
    import cv2
    from PIL import Image
except ImportError:
    print("Advertencia: Para usar este script en terminal necesitas instalar dependencias:")
    print("pip install opencv-python pillow numpy")

def binarize_floyd_steinberg(img_gray, threshold=128):
    """Aplica difusion de error Floyd-Steinberg para degradados suaves en OLED."""
    h, w = img_gray.shape
    img = img_gray.astype(np.float32)
    binary = np.zeros((h, w), dtype=np.uint8)

    for y in range(h):
        for x in range(w):
            old_val = img[y, x]
            new_val = 255.0 if old_val >= threshold else 0.0
            binary[y, x] = 1 if new_val == 255.0 else 0
            err = old_val - new_val

            if x + 1 < w:
                img[y, x + 1] += err * (7.0 / 16.0)
            if x - 1 >= 0 and y + 1 < h:
                img[y + 1, x - 1] += err * (3.0 / 16.0)
            if y + 1 < h:
                img[y + 1, x] += err * (5.0 / 16.0)
            if x + 1 < w and y + 1 < h:
                img[y + 1, x + 1] += err * (1.0 / 16.0)

    return binary

def frame_to_xbm(binary_matrix, width=128, height=64):
    """
    Convierte una matriz binaria (1=encendido, 0=apagado) al formato XBM.
    En XBM, cada byte contiene 8 pixeles horizontales,
    siendo el bit menos significativo (LSB, bit 0) el pixel de la izquierda.
    """
    bytes_per_row = (width + 7) // 8
    xbm_bytes = []

    for y in range(height):
        for byte_col in range(bytes_per_row):
            b = 0
            for bit in range(8):
                x = byte_col * 8 + bit
                if x < width:
                    if binary_matrix[y, x] == 1:
                        b |= (1 << bit)
            xbm_bytes.append(b)

    return xbm_bytes

def convert_video(input_path, output_path, width=128, height=64, fps=10, max_frames=100, threshold=128, invert=False):
    cap = cv2.VideoCapture(input_path)
    if not cap.isOpened():
        print(f"Error: No se pudo abrir {input_path}")
        return

    video_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_video_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    step = max(1, int(round(video_fps / fps)))

    print(f"Procesando: {input_path}")
    print(f"FPS Original: {video_fps:.1f} | FPS Destino: {fps} (Paso: cada {step} cuadros)")
    print(f"Resolucion pantalla: {width}x{height}")

    all_frames = []
    frame_idx = 0
    extracted_count = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if frame_idx % step == 0:
            # Redimensionar conservando aspect ratio con letterbox negro
            h_orig, w_orig = frame.shape[:2]
            scale = min(width / w_orig, height / h_orig)
            nw, nh = int(w_orig * scale), int(h_orig * scale)
            resized = cv2.resize(frame, (nw, nh), interpolation=cv2.INTER_AREA)

            # Canvas negro 128x64
            canvas = np.zeros((height, width, 3), dtype=np.uint8)
            dx = (width - nw) // 2
            dy = (height - nh) // 2
            canvas[dy:dy+nh, dx:dx+nw] = resized

            # Escala de grises
            gray = cv2.cvtColor(canvas, cv2.COLOR_BGR2GRAY)
            if invert:
                gray = 255 - gray

            # Dithering
            binary = binarize_floyd_steinberg(gray, threshold)
            xbm = frame_to_xbm(binary, width, height)
            all_frames.append(xbm)

            extracted_count += 1
            print(f"Extrayendo cuadro {extracted_count}...", end="\r")

            if extracted_count >= max_frames:
                break

        frame_idx += 1

    cap.release()
    print(f"\nTotal extraido: {len(all_frames)} fotogramas.")

    # Guardar en archivo .h
    bytes_per_frame = (width // 8) * height
    frame_delay = int(round(1000.0 / fps))

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(f"// Generado por convert.py para ESP32-S3 + SH1106 U8g2\n")
        f.write(f"#ifndef OLED_FRAMES_H\n#define OLED_FRAMES_H\n\n#include <Arduino.h>\n\n")
        f.write(f"#define FRAME_WIDTH  {width}\n")
        f.write(f"#define FRAME_HEIGHT {height}\n")
        f.write(f"#define FRAME_COUNT  {len(all_frames)}\n")
        f.write(f"#define FRAME_DELAY  {frame_delay} // ms\n\n")

        for idx, frame_bytes in enumerate(all_frames):
            f.write(f"const unsigned char frame_{idx}[{bytes_per_frame}] PROGMEM = {{\n  ")
            hex_vals = [f"0x{b:02x}" for b in frame_bytes]
            for r in range(0, len(hex_vals), 16):
                row = hex_vals[r:r+16]
                f.write(", ".join(row))
                if r + 16 < len(hex_vals):
                    f.write(",\n  ")
            f.write("\n};\n\n")

        f.write(f"const unsigned char* const epd_bitmap_allArray[FRAME_COUNT] PROGMEM = {{\n")
        for idx in range(len(all_frames)):
            sep = "," if idx < len(all_frames) - 1 else ""
            f.write(f"  frame_{idx}{sep}\n")
        f.write("};\n\n#endif\n")

    print(f"¡Listo! Archivo guardado con exito en: {output_path}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Conversor de Video a XBM para OLED SH1106")
    parser.add_argument("input", help="Ruta al archivo de video o imagen")
    parser.add_argument("--output", "-o", default="frames.h", help="Archivo .h de salida")
    parser.add_argument("--fps", type=int, default=10, help="Fotogramas por segundo")
    parser.add_argument("--max-frames", type=int, default=80, help="Maximo de cuadros")
    parser.add_argument("--threshold", type=int, default=128, help="Umbral (0-255)")
    parser.add_argument("--invert", action="store_true", help="Invertir colores")
    parser.add_argument("--width", type=int, default=128, help="Ancho pantalla")
    parser.add_argument("--height", type=int, default=64, help="Alto pantalla")

    args = parser.parse_args()
    convert_video(args.input, args.output, args.width, args.height, args.fps, args.max_frames, args.threshold, args.invert)
