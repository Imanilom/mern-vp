import { GoogleAuthProvider, getAuth, signInWithPopup } from 'firebase/auth';
import { app } from '../firebase';
import { useDispatch } from 'react-redux';
import { signInSuccess } from '../redux/user/userSlice';
import { useNavigate } from 'react-router-dom';
import { FcGoogle } from "react-icons/fc";

export default function OAuth() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  
  const handleGoogleClick = async () => {
    try {
      const provider = new GoogleAuthProvider(); 
      const auth = getAuth(app); // mengambil informasi auth project
      
      const result = await signInWithPopup(auth, provider); // proses login mengguanakn goggle account

      // kirim data goggle account ke server 
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: result.user.displayName, // nama goggle account
          email: result.user.email, // email google account
          photo: result.user.photoURL, // profile goggle account
        }),
      });

      const data = await res.json();

      // Simpan informasi login ke redux statement
      dispatch(signInSuccess(data));

      // arahkan ke home page
      navigate('/');
    } catch (error) {
      // tampilkan error ketika mencoba oAuth2
      console.log('could not sign in with google', error);
    }
  };

  return (

    <div className="flex justify-between mt-3">
      <button onClick={() => handleGoogleClick()} type="button" class="flex items-center gap-1 text-white bg-[#101010] hover:bg-gradient-to-br focus:ring-4 focus:outline-none focus:ring-blue-300 dark:focus:ring-blue-800 font-medium rounded-lg text-sm px-5 py-2.5 text-center mb-2">
        <FcGoogle size={24} className='me-2' />
        Connect with Google</button>
    </div>
  );
}