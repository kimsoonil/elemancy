import { defineConfig } from "@apps-in-toss/web-framework/config";

export default defineConfig({
  appName: "elemancy",
  brand: {
    displayName: "엘레맨시", // 화면에 노출될 앱의 한글 이름
    primaryColor: "#7b8cff", // Elemancy 액센트(우주 보라/블루)
    icon: "", // TODO: 출시 전 앱 아이콘 이미지 주소 등록 필요
  },
  web: {
    host: "localhost",
    port: 5173,
    commands: {
      dev: "vite dev",
      build: "vite build",
    },
  },
  permissions: [],
  outdir: "dist",
});
