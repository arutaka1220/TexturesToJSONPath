const fs = require("fs");
const fse = require("fs-extra");
const fsp = fs.promises;
const sleep = require("timers/promises").setTimeout;
const path = require("path");
const javaTokenToSafe = require("./javaTokenToSafe");

const PATH_ARG = process.argv[2];

const OUTPUT_FOLDER = path.join(__dirname, "output");

if (!PATH_ARG) {
    console.error(`texturesフォルダのパスを引数に入力してください。`);

    process.exit(1);
}

if (!fs.existsSync(PATH_ARG)) {
    console.error(`指定されたパスは存在しません。`);

    process.exit(1);
}

if (!fs.statSync(PATH_ARG).isDirectory()) {
    console.error(`指定されたパスはフォルダではありません。`);

    process.exit(1);
}

if (!PATH_ARG.endsWith("textures") && !PATH_ARG.endsWith("textures/")) {
    console.error(`指定されたパスはtexturesフォルダではありません。`);

    process.exit(1);
}

if (!fs.existsSync(OUTPUT_FOLDER)) {
    fs.mkdirSync(OUTPUT_FOLDER);
}

clearFolder(OUTPUT_FOLDER);
console.log(`[INFO] 出力フォルダをリセットしました。`);

sleep(1000, "");

const PATH = path.resolve(setPathType(PATH_ARG));

(async () => {
    /** @type { string[] } */
    const filePaths = await getFiles(PATH);

    const KeyName = {};
    const FileName = {};

    const startDate = Date.now();

    let lastOutputDate = null;

    for (const filePath of filePaths) {
        const extName = path.extname(filePath);

        if (extName !== ".png") console.log(`[WARN] ${path.basename(filePath)} は png ではないため、スキップします。`);

        const fileName = path.basename(filePath).replace(extName, "");
        const keyName = createItemName(fileName).toUpperCase();

        const safeKeyName = safe(keyName);
        const safeFileName = safe(fileName);

        KeyName[safeKeyName] = setPathType(path.join("textures", path.relative(PATH, filePath)));
        FileName[safeFileName] = setPathType(path.join("textures", path.relative(PATH, filePath)));

        if (lastOutputDate !== null && (Date.now() - lastOutputDate) < 1000) continue;

        lastOutputDate = Date.now();
        console.log(`[INFO] 現在のデータ数は ${Object.keys(KeyName).length}個 です (${Math.floor((Date.now() - startDate) / 1000)}秒が経過しました)`);
    }

    writeFile("KeyName.json", JSON.stringify(KeyName, null, 2), "utf-8");
    writeFile("FileName.json", JSON.stringify(FileName, null, 2), "utf-8");
    writeFile("KeyName.java", makeJavaStaticClass(KeyName), "utf-8");
    writeFile("FileName.java", makeJavaStaticClass(FileName), "utf-8");

    console.log(`[INFO] 処理が完了しました。`);
})();

/**
 * 
 * @param { string } filePath 
 * @param { string } data 
 */
function writeFile(filePath, data) {
    fs.writeFileSync(path.join(OUTPUT_FOLDER, filePath), data);

    console.log(`[INFO] ${path.basename(filePath)} にデータを保存しました。`);
}

const dupeCheck = [];

/**
 * 
 * @param { string } string
 * @returns { string } 
 */
function dupelicationCheck(string) {
    if (dupeCheck.includes(string)) {
        const resultString = string + "_";

        dupeCheck.push(resultString);
        return resultString;
    }

    dupeCheck.push(string);

    return string;
}

/**
 * 
 * @param { string } string 
 * @returns { string }
 */
function safe(string) {
    // ハイフンチェック
    string = string.replace(/\-/g, "_");

    // スペースチェック
    string = string.replace(/\s/g, "_");

    // 数字チェック
    const firstChar = string.charAt(0);
    const parseAble = !Number.isNaN(Number(firstChar));

    if (parseAble) string = string.replace(firstChar, "");

    string = javaTokenToSafe(string);

    return dupelicationCheck(string);
}

/**
 * 
 * @param { string } path 
 * @returns { string }
 */
function setPathType(path) {
    return path.replace(/\\/g, "/");
}

/**
 * 
 * @param { string } namespaceId 
 * @returns { string }
 */
function createItemName(namespaceId) {
    const hasNamespaceId = namespaceId.includes(":");

    if (hasNamespaceId) {
        const split = namespaceId.split(":")[1].split("_");
        return split.map((word) => word.charAt(0).toUpperCase() + word.substring(1)).join(" ");
    } else {
        const hasUnderBar = namespaceId.includes("_");

        if (hasUnderBar) {
            const split = namespaceId.split("_");
            return split.map((word) => word.charAt(0).toUpperCase() + word.substring(1)).join(" ")
        } else {
            return namespaceId.charAt(0).toUpperCase() + namespaceId.substring(1);
        }
    }
}

/**
 * 
 * @param { Record<string, string> } values 
 */
function makeJavaStaticClass(values) {
    let data = [
        `class TexturePaths {`
    ];

    for (const [key, value] of Object.entries(values)) {
        data.push(`    public static final String ${key} = "${value}";`);
    }

    data.push("}");

    return data.join("\n");
}

/**
 * 
 * @param { string } dir 
 */
async function clearFolder(dir) {
    const filePaths = await getFiles(dir);

    for (const filePath of filePaths) {
        fs.unlinkSync(filePath);
    }
}

/**
 * 
 * @param { string } dir 
 * @returns { Promise<string[]> }
 */
async function getFiles(dir) {
    const dirents = await fsp.readdir(dir, { withFileTypes: true });
    const files = await Promise.all(dirents.map((dirent) => {
        const res = path.resolve(dir, dirent.name);
        return dirent.isDirectory() ? getFiles(res) : res;
    }));
    return Array.prototype.concat(...files);
}