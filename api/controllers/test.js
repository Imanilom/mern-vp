import Log from '../models/log.model.js';
import {calculateQuartilesAndIQR, calculateDFA} from './data.controller.js';

const data = [12, 7, 3, 15, 10, 5, 8, 20, 18, 25]; // Contoh data
const result = calculateQuartilesAndIQR(data);

console.log(result); // Output: { Q1, Q3, IQR }

// const isi = async() => {
//     try {
//         const logs = await Log.find().limit(10);
//         // const dfa = calculateDFA(logs);
//         console.log(logs, );
        
//     } catch (error) {
//         console.log(error);
//     }
// }

// isi();