# 🎬 OLED Video & Bitmap Studio para ESP32-S3 + SH1106 (U8g2)

Herramienta web completa para convertir videos (`.mp4`, `.webm`) e imágenes (`.gif`, `.png`, `.jpg`) en arreglos de mapas de bits XBM compatibles con la librería **U8g2** en pantallas **OLED 1.3" SH1106 (128x64)** controladas por un **ESP32-S3 N16R8**.

Ofrece dos modalidades de uso:
1. **Flasheo Directo por USB (Web Serial API):** Graba el reproductor y el video directamente en cualquier ESP32 desde el navegador, sin compilar ni instalar Arduino IDE.
2. **Exportación Tradicional de Código:** Copia al portapapeles o descarga el sketch completo (`video_oled.ino`) y los arreglos de bitmaps (`frames.h`) listos para Arduino IDE.

---

## 🔌 1. Conexión de Pines: ESP32-S3 N16R8 a Pantalla OLED SH1106

| Pantalla OLED 1.3" | ESP32-S3 (Tu Conexión) | Pin Alternativo | Descripción |
| :--- | :--- | :--- | :--- |
| **GND** | **GND** | GND | Tierra común |
| **VCC** | **3.3V** (o 5V) | 3.3V | Alimentación de la pantalla |
| **SCK / SCL** | **GPIO 13** | **GPIO 9** | Reloj I2C (Clock) |
| **SDA** | **GPIO 8** | **GPIO 8** | Datos I2C (Data) |

> 💡 **¿Por qué funcionan los pines 8 y 13?**  
> El microcontrolador **ESP32-S3** cuenta con una matriz de conmutación interna (GPIO Matrix) que permite reasignar el bus I2C por hardware a prácticamente cualquier pin digital disponible. En el código simplemente llamamos a:
> ```cpp
> Wire.begin(8, 13); // SDA = 8, SCL = 13
> Wire.setClock(400000); // 400kHz Fast I2C para alta tasa de refresco
> ```
> Además, en el módulo **N16R8** (que usa Flash Octal y PSRAM Octal en GPIO 33-37), los pines **GPIO 8** y **GPIO 13** son completamente seguros y libres de conflicto.

---

## ⚡ 2. Flasheo Directo desde el Navegador (Web USB / Web Serial)

Si no quieres lidiar con librerías ni compiladores:
1. Abre la web en **Google Chrome** o **Microsoft Edge** (soportan Web Serial API).
2. Conecta tu **ESP32-S3** mediante un cable USB de datos a tu computadora.
3. Carga tu video o imagen y presiona **"Procesar"**.
4. Ve a la pestaña **`⚡ Grabar en ESP32 (Web USB)`**:
   - **Instalación Completa (Recomendado para ESP32 nuevo o primera vez):** Graba el firmware base universal + el video.
   - **Actualizar Solo Video (~2 seg):** Si ya tienes el firmware base en el micro, escribe únicamente los nuevos cuadros en la Flash a partir del offset `0x200000`.
5. Haz clic en **"Conectar y Grabar en ESP32"**, selecciona el puerto COM de tu ESP32 en la ventana emergente y ¡listo! En segundos tu pantalla OLED comenzará a reproducir el video.

---

## 💻 3. Exportar y Descargar Código para Arduino IDE

Si prefieres personalizar el sketch o integrarlo con otros sensores/sensores de tu proyecto:
- **Pestaña "Sketch Completo (.ino)":**
  - Botón **"Copiar .INO"**: copia todo el sketch C++ configurado para U8g2, Wire en pines 8 y 13, y 400kHz.
  - Botón **"Descargar video_oled.ino"**: descarga el archivo fuente directamente.
- **Pestaña "Arreglos XBM (frames.h)":**
  - Botón **"Copiar frames.h"**: copia la cabecera con todos los arreglos de bytes en memoria `PROGMEM`.
  - Botón **"Descargar frames.h"**: descarga el archivo para colocarlo junto a tu sketch.

---

## 🎨 4. Funciones Destacadas del Estudio Web

- **✨ Modo "Luz y Sombras (3s)" para Imágenes:**
  - Transforma cualquier foto o logo estático en una animación fluida de 3 segundos variando el umbral de iluminación de forma senoidal.
  - Otorga relieve, sombras volumétricas y contraste dinámico sin necesidad de tener un archivo de video.
- **Encuadre y Altura de Recorte (Crop Vertical):**
  - Al seleccionar escala en modo **Rellenar y recortar (Crop)**, puedes ajustar con un deslizador (0% a 100%) o botones rápidos (`Arriba`, `Centro`, `Abajo`) la altura exacta del encuadre para enfocar rostros, textos o zonas clave.
- **Recorte Automático a Segundos Enteros (MAX):**
  - Botón `MAX` y casilla de verificación para cortar el video exactamente al último segundo entero sin fracciones manuales.
- **Simulador OLED Fotorrealista:**
  - Renderiza la animación cuadro a cuadro con colores intercambiables (Azul Cian, Blanco Puro, Verde Fósforo, Amarillo Ámbar).

---

## ☁️ 5. Subir a Vercel

El proyecto está diseñado para funcionar 100% en el lado del cliente (Client-Side) sin requerir servidor backend:
- Ya incluye [`vercel.json`](file:///c:/Users/rayfe/Documents/Antigravity/IoT/ConversorVideo-OLED/vercel.json) con los encabezados adecuados para servir los binarios del firmware (`application/octet-stream`) y módulos JS.
- Para subirlo a Vercel:
  ```bash
  # Opción A: Vercel CLI
  vercel

  # Opción B: Git / GitHub
  # Sube la carpeta a un repositorio en GitHub y conéctalo en tu panel de vercel.com
  ```
- **Nota importante:** Web Serial API exige conexión segura (`https://`). Como Vercel proporciona HTTPS automáticamente en todos sus dominios, el flasheo USB funcionará de forma nativa desde el primer despliegue.

---

## 💾 6. Memoria y Límites en el ESP32-S3 N16R8

$$\text{Tamaño por cuadro} = \frac{128 \times 64 \text{ bits}}{8} = 1024 \text{ bytes} = 1 \text{ KB}$$

- **10 fotogramas** = 10 KB
- **100 fotogramas (10s a 10 FPS)** = 100 KB
- **500 fotogramas** = 500 KB (~0.5 MB)
- Tu **ESP32-S3 N16R8 cuenta con 16 MB de Flash**, lo que te permite almacenar miles de cuadros sin ningún riesgo de falta de memoria.
