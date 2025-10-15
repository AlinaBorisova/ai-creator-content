// Функция для извлечения HTML из markdown блока
export const extractHtmlFromMarkdown = (text: string): string | null => {
  const htmlMatch = text.match(/```html\n([\s\S]*?)\n```/);
  if (!htmlMatch) return null;

  let html = htmlMatch[1];

  // Добавляем CSS для убирания лишних отступов
  const resetCSS = `
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          margin: 0;
          padding: 0;
          overflow: visible;
        }
        html {
          margin: 0;
          padding: 0;
          overflow: visible;
        }
      </style>
    `;

  // Вставляем CSS в head
  html = html.replace(/<head>/i, `<head>${resetCSS}`);

  return html;
};