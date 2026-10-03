# Knihovník Mobile

Aplikace pro skenování a správy knihovního katalogu vytvořená v React + TypeScript + Vite.

## Lokální vývoj (Development)

1. Nainstalujte závislosti:
   ```bash
   npm ci
   ```

2. Spusťte vývojový server:
   ```bash
   npm run dev
   ```

3. Otevřete lokální adresu v prohlížeči (např. `http://localhost:5173`).

## Produkční sestavení (Build)

Pro vytvoření produkčního sestavení spusťte:
```bash
npm run build
```
Sestavené soubory budou uloženy ve složce `dist/`.

## Nasazení na GitHub Pages (Deployment)

Projekt obsahuje GitHub Actions workflow (`.github/workflows/deploy.yml`), které při každém pushi do větví `main`, `master` nebo `new-main` automaticky sestaví aplikaci (`npm run build`) a nasadí soubory ze složky `dist/`.

### Nastavení na GitHubu:
V nastavení repozitáře (**Settings -> Pages**):
- **Source**: Zvolte buď **GitHub Actions**, nebo **Deploy from a branch** (větev `gh-pages` / složka `/ (root)`).
- Tím se zajistí, že webový server bude servírovat zkompilovaný JavaScript z `dist/` složky místo zdrojového `.tsx` souboru, a aplikace tak bez problémů funguje v Chrome na PC i na mobilních zařízeních (Android / iOS).
