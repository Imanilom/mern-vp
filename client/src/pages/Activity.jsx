import { useSelector } from 'react-redux';
import { useRef, useState, useEffect } from 'react';
import Side from '../components/Side'
import { Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';

function Acitivity() {
  const [useractivitys, setUseractivitys] = useState([]);
  const { currentUser } = useSelector((state) => state.user);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [aktivitas, setAktivitas] = useState(null);
  const dispatch = useDispatch();
  const [formData, setFormData] = useState({});

  const handleactivityDelete = async (activityId) => {
    try {
      const res = await fetch(`/api/activity/delete/${activityId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success === false) {
        console.log(data.message);
        return;
      }

      setUseractivitys((prev) =>
        prev.filter((activity) => activity._id !== activityId)
      );
    } catch (error) {
      console.log(error.message);
    }
  };
  
  useEffect(() => {
    const fetchLog = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/activity/getActivity`);
        const data = await res.json();
        if (data.success === false) {
      
          return;
        }
        console.log(data)
        setAktivitas(data)
        
     
      } catch (error) {

      }
    };
    fetchLog();
  });
  return (
    <main class="bg-white flex">
    <Side />
  <div class="w-full xl:w-8/12 mb-12 xl:mb-0 px-4 mx-auto mt-24">
    <div class="relative flex flex-col min-w-0 break-words bg-white w-full mb-6 shadow-lg rounded ">
      <div class="rounded-t mb-0 px-4 py-3 border-0">
        <div class="flex flex-wrap items-center">
          <div class="relative w-full px-4 max-w-full flex-grow flex-1">
            <h3 class="font-semibold text-base text-blueGray-700">Aktivitas</h3>
          </div>
          <div class="relative w-full px-4 max-w-full flex-grow flex-1 text-right">
            <Link to={'/createActivity'}>
              <button class="bg-indigo-500 text-white active:bg-indigo-600 text-xs font-bold uppercase px-3 py-1 rounded outline-none focus:outline-none mr-1 mb-1 ease-linear transition-all duration-150" type="button">
                Tambahkan aktivitas
              </button>
            </Link>
          </div>
        </div>
      </div>

      <div class="block w-full overflow-x-auto">
      <table class="items-center bg-transparent w-full border-collapse ">
          <thead>
            <tr>
              <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle border border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                Tanggal
              </th>
              <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle border border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                Awal
              </th>
              <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle border border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                Akhir
              </th>
              <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle border border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                Aktivitas
              </th>
              <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle border border-solid border-blueGray-100 py-3 text-center text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                Aksi
              </th>
            </tr>
          </thead>

          <tbody>
          {aktivitas?.map((aktivitas) => (
              <tr key={aktivitas._id}>
              <th class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 text-left text-blueGray-700 ">
                {aktivitas.Date}
              </th>
              <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 ">
              {aktivitas.awal}
              </td>
              <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 ">
              {aktivitas.akhir}
              </td>
              <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 ">
              {aktivitas.aktivitas} 
              </td>
              <td>
                <div class="relative w-full px-4 max-w-full flex-grow flex-1 text-right">
                <Link to={`/updateActivity/${aktivitas._id}`}>
                  <button class="bg-indigo-500 text-white active:bg-indigo-600 text-xs font-bold uppercase px-3 py-1 rounded outline-none focus:outline-none mr-1 mb-1 ease-linear transition-all duration-150" type="button">Update</button>
                </Link>
                  <button class="bg-indigo-500 text-white active:bg-indigo-600 text-xs font-bold uppercase px-3 py-1 rounded outline-none focus:outline-none mr-1 mb-1 ease-linear transition-all duration-150" type="button">Delete</button>
                </div>
              </td>
              </tr>
          ))}
           
       
          </tbody>
        </table>
      </div>
    </div>
  </div>
</main>
   
  )
}

export default Acitivity