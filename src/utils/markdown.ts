// Функция для извлечения HTML из markdown блока или напрямую
export const extractHtmlFromMarkdown = (text: string): string | null => {
  // Сначала проверяем наличие markdown блока
  const htmlMatch = text.match(/\n([\s\S]*?)\n```/);
  let html: string | null = null;

  if (htmlMatch) {
    // HTML найден в markdown блоке
    html = htmlMatch[1];
  } else {
    // Проверяем, начинается ли текст напрямую с HTML
    const directHtmlMatch = text.match(/^\s*(<!DOCTYPE\s+html|<\s*html)/i);
    if (directHtmlMatch) {
      // Находим весь HTML документ (от начала до закрывающего </html>)
      const fullHtmlMatch = text.match(/(<!DOCTYPE\s+html[\s\S]*?<\/html>)/i);
      if (fullHtmlMatch) {
        html = fullHtmlMatch[1];
      } else {
        // Если нет закрывающего тега, берем весь текст от начала HTML
        const startIndex = text.search(/<!DOCTYPE\s+html|<html/i);
        if (startIndex !== -1) {
          html = text.substring(startIndex);
        }
      }
    }
  }

  if (!html) return null;

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

  // Вставляем CSS в head, если head существует
  if (html.includes('<head>')) {
    html = html.replace(/<head>/i, `<head>${resetCSS}`);
  } else if (html.includes('<html')) {
    // Если нет head, добавляем его после открывающего тега html
    html = html.replace(/(<html[^>]*>)/i, `$1<head>${resetCSS}</head>`);
  } else {
    // Если нет даже html тега, оборачиваем в полный HTML документ
    html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${resetCSS}
</head>
<body>
${html}
</body>
</html>`;
  }

  return html;
};