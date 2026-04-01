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

export const ConversationController = {
	conversationDataToConvType(data) {
		const conversationsMap = new Map();

		data.forEach((row) => {
			const camelRow = convertKeysToCamel(row);

			if (!conversationsMap.has(camelRow.conversationId)) {
				conversationsMap.set(camelRow.conversationId, {
					conversationId: camelRow.conversationId,
					type: camelRow.type,
					name: camelRow.name,
					createdAt: camelRow.createdAt,
					messages: [],
				});
			}

			const conversation = conversationsMap.get(camelRow.conversationId);
			conversation.messages.push({
				id: camelRow.messageId,
				senderId: camelRow.senderId,
				receiverId: camelRow.receiverId,
				content: camelRow.content,
				timestamp: camelRow.timestamp,
				type: camelRow.senderId === 1 ? "system" : "user"
			});
		});

		const conversationsObject = Object.fromEntries(conversationsMap);
		return (conversationsObject);
	}
}
