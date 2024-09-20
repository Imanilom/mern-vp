import ftp from 'basic-ftp';
import dotenv from 'dotenv';
import fs from 'fs';
import cron from 'node-cron';

dotenv.config({ path: '../../.env' });

async function SendFileToFtp(pathfile, pathfileFtp) {
    try {
        const client = new ftp.Client();
        client.ftp.verbose = true;

        await client.access({
            host: process.env.FTP_HOST,   // Sesuaikan host FTP
            user: process.env.FTP_USER,          // Sesuaikan username FTP
            password: process.env.FTP_PASSWORD,      // Sesuaikan password FTP
            secure: process.env.FTP_SECURE,          // Set secure ke true jika menggunakan FTPS
            port: process.env.FTP_PORT
        });

        console.log("Mengupload file ke FTP...");
        await client.uploadFrom(pathfile, pathfileFtp);
        // param 1 : lokasi file kita, param 2 : lokasi menyimpan file di ftp 
        console.log("File berhasil diupload ke FTP");

    } catch (error) {
        console.log({ error });
    }
}


async function DownloadFromFtp(filename, pathfileFtp) {
    const client = new ftp.Client();
    client.ftp.verbose = true;

    if(!fs.existsSync('./data')){
        fs.mkdirSync('./data');
    }

    try {
        await client.access({
            host: process.env.FTP_HOST,   // Sesuaikan host FTP
            user: process.env.FTP_USER,          // Sesuaikan username FTP
            password: process.env.FTP_PASSWORD,      // Sesuaikan password FTP
            secure: process.env.FTP_SECURE,          // Set secure ke true jika menggunakan FTPS
            port: process.env.FTP_PORT
        });

        try {
            // Mengunduh file JSON dari FTP dan menyimpannya ke server lokal
            await client.downloadTo(pathfile, pathfileFtp);
            // param 1 lokasi menyimpan file, param 2 lokasi tempat file di FTP server
    
            console.log("File berhasil diunduh dari FTP");
        } catch (error) {
            console.log('File tidak ditemukan di ftp');
        }

        // Baca file JSON yang diunduh
        // const jsonFilePath = path.join(__dirname, "downloaded_monitoring.json");
        // const jsonData = fs.readFileSync(jsonFilePath, "utf8");

        // Kirim data JSON ke frontend
        // res.json(JSON.parse(jsonData));

    } catch (error) {
        console.log({ error })
    }
}

// DownloadFromFtp('./test/test.json', './data/data_2024620.json');

async function TransferfileToFtp() {
    
    // cek directory
    if (!fs.existsSync('./data')) {
        fs.mkdirSync('./data');
    }

    // name file
    const now = new Date();
    const namefile = `${now.getFullYear()}${now.getMonth() + 1}${now.getDay()}.json`;

    if (!fs.existsSync(`./data/${namefile}`)) { // mengecek apakah file json untuk hari ini ada disini
        console.log('tidak ada file json ' + namefile + ' Pengiriman file ke ftp di batalkan');
        return;
    }

    const pathfile = `./data/${namefile}`;
    const pathfileFTP = `./data/${namefile}`;

    await SendFileToFtp(pathfile, pathfileFTP);

    console.log('Mengirim file ' + namefile + ' ke Ftp berhasil.');
}

// TransferfileToFtp();

// DownloadFromFtp('./test/202494.json', './data/202494.json');

const handleGetFromFile = async () => {
    // const {startTime, endTime} = new Date();
    // const isHaveInputDate = false; 
    // if(!isHaveInputDate){
    //     let date = new Date();
    // }else{
        
    // }
}

cron.schedule("30 23 * * *", () => {
    TransferfileToFtp();
});