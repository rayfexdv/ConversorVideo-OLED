/*
 * Reproductor de Animacion / Video OLED para ESP32-S3 N16R8
 * Pantalla: OLED 1.3" SH1106 I2C 128x64
 * Libreria: U8g2 by olikraus
 * Conexiones de Pines:
 *   - OLED SDA -> ESP32-S3 GPIO 8
 *   - OLED SCK -> ESP32-S3 GPIO 13 (o GPIO 9)
 *   - OLED VCC -> ESP32-S3 3.3V
 *   - OLED GND -> ESP32-S3 GND
 */

#include <Wire.h>
#include <U8g2lib.h>
#include "frames.h"

// Definicion de pines I2C configurados para tu conexion
#define OLED_SDA 8
#define OLED_SCL 13

// Constructor SH1106 I2C por Hardware en buffer completo (Full Buffer _F_)
// Para SH1106 128x64:
U8G2_SH1106_128X64_NONAME_F_HW_I2C u8g2(U8G2_R0, /* reset=*/ U8X8_PIN_NONE);

int currentFrame = 0;

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("Iniciando ESP32-S3 OLED Video Player...");

  // Iniciar bus I2C con tus pines personalizados (SDA=8, SCL=13)
  Wire.begin(OLED_SDA, OLED_SCL);
  // Acelerar bus a 400kHz (Fast Mode) para maxima tasa de cuadros
  Wire.setClock(400000);

  // Iniciar U8g2
  u8g2.begin();
  u8g2.clearBuffer();
  u8g2.setFont(u8g2_font_ncenB08_tr);
  u8g2.drawStr(10, 36, "Cargando Video...");
  u8g2.sendBuffer();
  delay(1000);
}

void loop() {
  // Limpiar buffer de pantalla
  u8g2.clearBuffer();

  // Dibujar cuadro XBM actual
  // drawXBMP lee directamente desde la memoria Flash (PROGMEM)
  u8g2.drawXBMP(0, 0, FRAME_WIDTH, FRAME_HEIGHT, epd_bitmap_allArray[currentFrame]);

  // Enviar a la pantalla OLED SH1106
  u8g2.sendBuffer();

  // Avanzar cuadro en bucle continuo
  currentFrame++;
  if (currentFrame >= FRAME_COUNT) {
    currentFrame = 0;
  }

  // Tiempo de espera segun FPS configurados
  delay(FRAME_DELAY);
}
