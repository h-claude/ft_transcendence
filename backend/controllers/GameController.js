function toCamel(str) {
	return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function convertKeysToCamel(obj) {
	const result = {};
	for (const key in obj) {
		if (Object.hasOwn(obj, key)) {
			result[toCamel(key)] = obj[key];
		}
	}
	return result;
}
