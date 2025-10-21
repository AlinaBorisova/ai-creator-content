export const downloadImage = async (imageBytes: string, mimeType: string, filename: string) => {
	try {
		const byteCharacters = atob(imageBytes);
		const byteNumbers = new Array(byteCharacters.length);
		for (let i = 0; i < byteCharacters.length; i++) {
			byteNumbers[i] = byteCharacters.charCodeAt(i);
		}
		const byteArray = new Uint8Array(byteNumbers);
		const blob = new Blob([byteArray], { type: mimeType });

		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = filename;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);

		console.log('📥 Image downloaded:', filename);
	} catch (error) {
		console.error('❌ Error downloading image:', error);
	}
};

export const copyPromptToClipboard = async (promptText: string) => {
	try {
		await navigator.clipboard.writeText(promptText);
		console.log('Промпт скопирован в буфер обмена');
	} catch (error) {
		console.error('Ошибка при копировании промпта:', error);
	}
};