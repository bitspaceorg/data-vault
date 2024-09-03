const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

const askQuestion = (question) => {
	return new Promise((resolve) => {
		rl.question(question, (answer) => {
			resolve(answer);
		});
	});
};

const promptForData = async (structure, depth = 0) => {
	const indent = ' '.repeat(depth * 2);
	let data = Array.isArray(structure) ? [] : {};

	if (Array.isArray(structure)) {
		let isAdding = true;
		while (isAdding) {
			const itemData = await promptForData(structure[0], depth + 1);
			data.push(itemData);

			const continueAdding = await askQuestion(`${indent}Add another item to the array? (y/n): `);
			if (continueAdding.toLowerCase() !== 'y') {
				isAdding = false;
			}
		}
	} else {
		for (const [key, value] of Object.entries(structure)) {
			if (Array.isArray(value)) {
				console.log(`${indent}${key} (array):`);
				data[key] = await promptForData(value, depth + 1);
			} else if (typeof value === 'object') {
				console.log(`${indent}${key}:`);
				data[key] = await promptForData(value, depth + 1);
			} else {
				const userInput = await askQuestion(`${indent}${key}: `);
				data[key] = userInput;
			}
		}
	}

	return data;
};

const createStructureFiles = async (folderName) => {
	const structure = {};
	const metadataStructure = {};
	let isAdding = true;

	const askFields = async (obj, metaObj, depth = 0) => {
		const indent = ' '.repeat(depth * 2);

		while (isAdding) {
			const fieldName = await askQuestion(`${indent}Enter a field name (or type 'done' to finish): `);
			if (fieldName.toLowerCase() === 'done') {
				break;
			}

			const isNested = await askQuestion(`${indent}Is this field a nested structure? (y/n): `);
			if (isNested.toLowerCase() === 'y') {
				const isArray = await askQuestion(`${indent}Is this field an array? (y/n): `);
				if (isArray.toLowerCase() === 'y') {
					obj[fieldName] = [{}];
					metaObj[fieldName] = [{}];
					await askFields(obj[fieldName][0], metaObj[fieldName][0], depth + 1);
				} else {
					obj[fieldName] = {};
					metaObj[fieldName] = {};
					await askFields(obj[fieldName], metaObj[fieldName], depth + 1);
				}
			} else {
				obj[fieldName] = "";
			}

			const includeInMetadata = await askQuestion(`${indent}Include "${fieldName}" in metadata? (y/n): `);
			if (includeInMetadata.toLowerCase() === 'y') {
				metaObj[fieldName] = "";
			}
		}
	};

	await askFields(structure, metadataStructure);

	fs.mkdirSync(folderName, { recursive: true });
	fs.writeFileSync(path.join(folderName, '.structure'), JSON.stringify(structure, null, 2));
	console.log(`Structure file created at ${path.join(folderName, '.structure')}`);

	fs.writeFileSync(path.join(folderName, '.metadataStructure'), JSON.stringify(metadataStructure, null, 2));
	console.log(`Metadata structure file created at ${path.join(folderName, '.metadataStructure')}`);
};

const updateMetadataFile = async (folderName, addName, data) => {
	const metadataFilePath = path.join(folderName, 'metadata.json');
	let metadata = {};

	if (fs.existsSync(metadataFilePath)) {
		metadata = JSON.parse(fs.readFileSync(metadataFilePath, 'utf-8'));
	}

	const metadataStructureFilePath = path.join(folderName, '.metadataStructure');
	const metadataStructure = JSON.parse(fs.readFileSync(metadataStructureFilePath, 'utf-8'));

	const extractMetadata = (structure, data) => {
		const metadataObject = {};
		for (const [key, value] of Object.entries(structure)) {
			if (Array.isArray(value)) {
				metadataObject[key] = data[key].map(item => extractMetadata(value[0], item));
			} else if (typeof value === 'object') {
				metadataObject[key] = extractMetadata(value, data[key]);
			} else {
				if (metadataStructure.hasOwnProperty(key)) {
					metadataObject[key] = data[key];
				}
			}
		}
		return metadataObject;
	};

	const structureFilePath = path.join(folderName, '.structure');
	const structure = JSON.parse(fs.readFileSync(structureFilePath, 'utf-8'));

	const metadataObject = extractMetadata(structure, data);

	if (!metadata[addName]) {
		metadata[addName] = metadataObject;
	} else {
		metadata[addName] = metadataObject;
	}

	fs.writeFileSync(metadataFilePath, JSON.stringify(metadata, null, 2));
	console.log(`Metadata updated in "${metadataFilePath}".`);
};

const main = async () => {
	const action = await askQuestion('Enter action (submodule/add): ');

	if (action === 'submodule') {
		const folderName = await askQuestion('Enter folder name: ');
		await createStructureFiles(folderName);
	} else if (action === 'add') {
		const folderName = await askQuestion('Enter folder name where to add: ');
		const addName = await askQuestion('Enter add name: ');
		const structureFilePath = path.join(folderName, '.structure');
		const infoFilePath = path.join(folderName, addName, 'info.json');

		if (fs.existsSync(structureFilePath)) {
			const structure = JSON.parse(fs.readFileSync(structureFilePath, 'utf-8'));
			const data = await promptForData(structure);

			fs.mkdirSync(path.dirname(infoFilePath), { recursive: true });

			fs.writeFileSync(infoFilePath, JSON.stringify(data, null, 2));
			console.log(`Data added to "${infoFilePath}".`);

			await updateMetadataFile(folderName, addName, data);
		} else {
			console.log('Structure file does not exist!');
		}
	} else {
		console.log('Invalid action. Use "submodule" or "add".');
	}

	rl.close();
};

main();
