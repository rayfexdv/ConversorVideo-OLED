/*
 * =====================================================================================
 * ESP32-S3 Universal OLED Video Player Firmware
 * Lee los fotogramas dinámicamente desde la partición de Flash (offset 0x200000)
 * =====================================================================================
 */

#include <Wire.h>
#include <U8g2lib.h>
#include "esp_flash.h"

#define OLED_SDA 8
#define OLED_SCL 13

// Dirección de memoria Flash donde el conversor web escribe el video
#define VIDEO_FLASH_OFFSET 0x200000

// Identificador mágico "VIDE" (Little Endian: 0x45444956)
#define VIDEO_MAGIC 0x45444956

// Constructor para pantalla SH1106 128x64 I2C
U8G2_SH1106_128X64_NONAME_F_HW_I2C u8g2(U8G2_R0, U8X8_PIN_NONE);

struct VideoHeader {
  uint32_t magic;      // 4 bytes: 0x45444956 ("VIDE")
  uint16_t frameCount; // 2 bytes: total de fotogramas
  uint16_t frameDelay; // 2 bytes: retardo en ms por cuadro
  uint8_t  width;      // 1 byte: ancho en píxeles (ej. 128)
  uint8_t  height;     // 1 byte: alto en píxeles (ej. 64)
  uint16_t reserved;   // 2 bytes: reservado
} __attribute__((packed));

VideoHeader header;
uint8_t frameBuffer[1024];
int currentFrame = 0;
bool hasValidVideo = false;

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n[OLED Video Studio] Iniciando ESP32-S3 Universal Player...");

  Wire.begin(OLED_SDA, OLED_SCL);
  Wire.setClock(400000);
  u8g2.begin();

  // Leer cabecera desde la memoria Flash
  esp_err_t err = esp_flash_read(esp_flash_default_chip, &header, VIDEO_FLASH_OFFSET, sizeof(header));

  if (err == ESP_OK && header.magic == VIDEO_MAGIC && header.frameCount > 0 && header.frameCount <= 2000) {
    hasValidVideo = true;
    Serial.printf("[OK] Video detectado: %d cuadros | %d ms delay | %dx%d px\n", 
                  header.frameCount, header.frameDelay, header.width, header.height);
  } else {
    hasValidVideo = false;
    Serial.printf("[AVISO] Sin video en Flash (magic: 0x%08X). Mostrando pantalla de espera.\n", header.magic);
    
    u8g2.clearBuffer();
    u8g2.setFont(u8g2_font_ncenB08_tr);
    u8g2.drawStr(14, 25, "OLED Studio");
    u8g2.drawStr(8, 45, "Esperando Video...");
    u8g2.drawFrame(0, 0, 128, 64);
    u8g2.sendBuffer();
  }
}

void loop() {
  if (!hasValidVideo) {
    // Si no hay video, revisar periódicamente por si se acaba de flashear
    delay(1000);
    esp_flash_read(esp_flash_default_chip, &header, VIDEO_FLASH_OFFSET, sizeof(header));
    if (header.magic == VIDEO_MAGIC && header.frameCount > 0) {
      hasValidVideo = true;
      currentFrame = 0;
    }
    return;
  }

  // Calcular desplazamiento del fotograma actual en Flash
  uint32_t frameOffset = VIDEO_FLASH_OFFSET + sizeof(VideoHeader) + (currentFrame * 1024);
  
  // Leer los 1024 bytes del cuadro actual desde la Flash
  esp_err_t err = esp_flash_read(esp_flash_default_chip, frameBuffer, frameOffset, 1024);
  if (err != ESP_OK) {
    delay(100);
    return;
  }

  // Dibujar en pantalla OLED
  u8g2.clearBuffer();
  u8g2.drawXBMP(0, 0, header.width, header.height, frameBuffer);
  u8g2.sendBuffer();

  // Avanzar cuadro
  currentFrame++;
  if (currentFrame >= header.frameCount) {
    currentFrame = 0;
  }

  // Esperar según los FPS configurados
  delay(header.frameDelay > 0 ? header.frameDelay : 50);
}
