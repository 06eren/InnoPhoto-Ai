# 🎨 InnoPhoto AI Studio

**InnoPhoto-Ai**, cihazınızda yerel (local) olarak çalışan yapay zeka modellerini kullanarak resim oluşturma, düzenleme, nesne kaldırma ve kalite artırma gibi gelişmiş görsel işleme süreçlerini gerçekleştiren modern bir masaüstü uygulamasıdır.

Electron, React ve TypeScript mimarisiyle geliştirilen bu araç, bulut servislerine bağımlı kalmadan tamamen kendi donanımınız üzerinde yüksek gizlilik ve performansla çalışır.

---

## ✨ Temel Özellikler

* 🖼️ **AI Görsel Oluşturma:** Yerel modeller indirerek metinden görsele (Text-to-Image) yüksek kalitede resimler üretin.
* 🧹 **Nesne ve Öğe Kaldırma (Inpainting):** Görseldeki istenmeyen nesneleri veya kişileri yapay zeka ile pürüzsüzce silin.
* ✂️ **Arka Plan Silme:** Görsellerin arka planını tek tıkla ve yüksek hassasiyetle temizleyin.
* 🔍 **Görsel Kalitesi Artırma (Upscaling):** Düşük çözünürlüklü fotoğrafları yapay zeka modelleriyle netleştirin ve detaylandırın.
* 🪄 **Ekleme & Düzenleme:** Görsellere yeni nesneler veya dokunuşlar ekleyerek içeriklerinizi zenginleştirin.
* 🔒 **Tam Gizlilik (Local AI):** İşlemler cihaz üzerinde lokal modellerle yapıldığı için verileriniz ve görselleriniz dışarıya aktarılmaz.

---


## 🚀 İndirme ve Kurulum

### 1. Kullanıma Hazır Masaüstü Sürümü (Önerilen)
Uygulamayı doğrudan bilgisayarınıza kurup çalıştırmak için:

1. Sağ taraftaki **[Releases](../../releases/tag/v1-beta)** bölümüne gidin.
2. Yayınlanan **`v1-beta`** paketini indirip kurulumu tamamlayın.
3. Uygulama içerisinden gerekli yapay zeka modellerini indirerek kullanmaya başlayın!

### 2. Geliştiriciler İçin (Kaynak Koddan Çalıştırma)
Projeyi yerel ortamınızda derlemek ve geliştirmek isterseniz:

```bash
# Repoyu klonlayın
git clone [https://github.com/06eren/InnoPhoto-Ai.git](https://github.com/06eren/InnoPhoto-Ai.git)

# Proje dizinine girin
cd InnoPhoto-Ai

# Bağımlılıkları yükleyin
npm install

# Uygulamayı geliştirici modunda başlatın
npm run dev
