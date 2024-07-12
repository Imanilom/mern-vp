import React, { useState } from 'react'
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';

function CreateActivity() {
  const { currentUser } = useSelector((state) => state.user);
  const navigate = useNavigate();
  const [selectedOption, setSelectedOption] = useState('');
  const options = ['Berjalan', 'Tidur', 'Berolahraga'];
  const [formData, setFormData] = useState({
    tanggal: '',
    awal: '',
    akhir: '',
    aktivitas: '',
  });


  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.id]: e.target.value,
    });

   
  }

  const handleSelectChange = (event) => {
    setSelectedOption(event.target.value);
    setFormData({
      ...formData,
      aktivitas: event.target.value,
    })
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/activity/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          userRef: currentUser._id,
        }),
      });
      const data = await res.json();
      setLoading(false);
      if (data.success === false) {
        setError(data.message);
      }
      navigate('/activity');
    } catch (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  return (

    <div class="flex min-h-screen items-center justify-start bg-white">
      <div class="mx-auto w-full max-w-lg">
        <h1 class="text-4xl font-medium">Create Activity</h1>
        <p class="mt-3">Insert below</p>

        <form onSubmit={handleSubmit} action="https://api.web3forms.com/submit" class="mt-10">
          <div class="grid gap-6 mt-5 mb-5 sm:grid-cols-1">
            <div class="relative z-0">
              <input type="date" onChange={handleChange} value={formData.tanggal} id="tanggal" name="tanggal" class="peer block w-full appearance-none border-0 border-b border-gray-500 bg-transparent py-2.5 px-0 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-0" placeholder=" " />
              <label class="absolute top-3 -z-10 origin-[0] -translate-y-6 scale-75 transform text-sm text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-0 peer-focus:-translate-y-6 peer-focus:scale-75 peer-focus:text-blue-600 peer-focus:dark:text-blue-500">Tanggal</label>
            </div>
          </div>
          <div class="grid gap-6 sm:grid-cols-2">
            <div class="relative z-0">
              <input type="time" onChange={handleChange} value={formData.awal} id="awal" name="awal" class="peer block w-full appearance-none border-0 border-b border-gray-500 bg-transparent py-2.5 px-0 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-0" placeholder=" " />
              <label class="absolute top-3 -z-10 origin-[0] -translate-y-6 scale-75 transform text-sm text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-0 peer-focus:-translate-y-6 peer-focus:scale-75 peer-focus:text-blue-600 peer-focus:dark:text-blue-500">Waktu Awal</label>
            </div>
            <div class="relative z-0">
              <input type="time" onChange={handleChange} value={formData.akhir} id="akhir" name="akhir" class="peer block w-full appearance-none border-0 border-b border-gray-500 bg-transparent py-2.5 px-0 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-0" placeholder=" " />
              <label class="absolute top-3 -z-10 origin-[0] -translate-y-6 scale-75 transform text-sm text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-0 peer-focus:-translate-y-6 peer-focus:scale-75 peer-focus:text-blue-600 peer-focus:dark:text-blue-500">Waktu Akhir</label>
            </div>
            <div>
              <label class="absolute top-3 -z-10 origin-[0] -translate-y-6 scale-75 transform text-sm text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-0 peer-focus:-translate-y-6 peer-focus:scale-75 peer-focus:text-blue-600 peer-focus:dark:text-blue-500">Select an option:</label>
              <select value={selectedOption} id="aktivitas" onChange={handleSelectChange}>
                <option value="" disabled >
                  Select an option
                </option>
                {options.map((option, index) => (
                  <option key={index} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" class="mt-5 rounded-md bg-black px-10 py-2 text-white">Send Message</button>
            <Link to='/activity' class="mt-5 rounded-md border border-transparent hover:border-gray-400/30 hover:shadow-xl px-10 py-2 text-black">Cancel</Link>

          </div>
        </form>
      </div>
    </div>
  )
}

export default CreateActivity