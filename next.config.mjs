/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // unpdf тянет сборку pdf.js — пусть подключается на сервере как есть,
    // без переупаковки бандлером (иначе ломается чтение PDF в проде).
    serverComponentsExternalPackages: ["unpdf"],
  },
};
export default nextConfig;
