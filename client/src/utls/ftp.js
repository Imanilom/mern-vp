// File untuk menampung component dari package tertentu


import fs from 'fs';
import ftp from 'basic-ftp';

export const readFileExistOnFTP = async (startDate, endDate) => {
    const client = new ftp.Client();
    try {

        await client.access({
            host: 'ftp5.pptik.id',   // Sesuaikan host FTP
            user: 'healthdevice-ftp',       // Sesuaikan username FTP
            password: "3a!xQAfizb",  // Sesuaikan password FTP
            secure: false,   // Set secure ke true jika menggunakan FTPS
            port: 2121
        });


        const list = await client.list('/hrv-results');
        // console.log({ list }, 'this is first ', list[0]['name']);
        const files = list.filter(file => {
            // Extract tanggal dari nama file
            const fileDateM = file.name.match(/log_(\d{4}-\d{2}-\d{2})/);

            // if (fileDate) {
            //     return fileDate[1] === '2024-05-28'; // Sesuaikan dengan input tanggal dari user
            // }
            // return false;

            if (fileDateM) {
                const fileDate = new Date(fileDateM[1]); // Ubah ke objek Date
                console.log({fileDate})
                // Cek apakah tanggal file berada dalam rentang tanggal input
                return fileDate >= new Date(startDate) && fileDate <= new Date(endDate);
            }
            return false;
        });

        console.log({files}, files.length);
        const filenameList = files.map(file => file.name);
        console.log({filenameList})
        const filelocal = [];
        const fileftp = [];
        files.map((file) => {
            if(fs.existsSync(`../../data/${file.name}`)){
                filelocal.push(file.name)
            }else{
                fileftp.push(file.name)
            }
        })
        console.log({fileftp, filelocal});
    } catch (error) {
        console.log({ error })
    }
}


readFileExistOnFTP('2023-07-24', '2024-08-29');