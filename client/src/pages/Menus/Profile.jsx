import { useSelector } from 'react-redux';
import { useRef, useState, useEffect } from 'react';
import {
  getDownloadURL,
  getStorage,
  ref,
  uploadBytesResumable,
} from 'firebase/storage';
import { app } from '../../firebase';
import { useDispatch } from 'react-redux';
import {
  updateUserStart,
  updateUserSuccess,
  updateUserFailure,
  deleteUserStart,
  deleteUserSuccess,
  deleteUserFailure,
  signOutUserStart,
  docterUnsetUser
} from '../../redux/user/userSlice';

export default function Profile() {
  const dispatch = useDispatch();
  const fileRef = useRef(null);
  const [image, setImage] = useState(undefined);
  const [imagePercent, setImagePercent] = useState(0);
  const [imageError, setImageError] = useState(false);
  const [formData, setFormData] = useState({});
  const [updateSuccess, setUpdateSuccess] = useState(false);

  const { currentUser, loading, error } = useSelector((state) => state.user);
  useEffect(() => {
    if (image) {
      handleFileUpload(image);
    }
  }, [image]);

  const handleFileUpload = async (image) => {
    const storage = getStorage(app);
    const fileName = new Date().getTime() + image.name;
    const storageRef = ref(storage, fileName);
    const uploadTask = uploadBytesResumable(storageRef, image);
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress =
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setImagePercent(Math.round(progress));
      },
      (error) => {
        setImageError(true);
      },
      () => {
        getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) =>
          setFormData({ ...formData, profilePicture: downloadURL })
        );
      }
    );
  };
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      dispatch(updateUserStart());
      const res = await fetch(`/api/user/update/${currentUser._id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.success === false) {
        dispatch(updateUserFailure(data));
        return;
      }
      dispatch(updateUserSuccess(data));
      setUpdateSuccess(true);
    } catch (error) {
      dispatch(updateUserFailure(error));
    }
  };

  const handleDeleteAccount = async () => {
    try {
      dispatch(deleteUserStart());
      const res = await fetch(`/api/user/delete/${currentUser._id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success === false) {
        dispatch(deleteUserFailure(data));
        return;
      }
      dispatch(deleteUserSuccess(data));
    } catch (error) {
      dispatch(deleteUserFailure(error));
    }
  };

  const handleSignOut = async () => {
    try {
      dispatch(signOutUserStart());
      const res = await fetch('/api/auth/signout');
      const data = await res.json();
      if (data.success === false) {
        dispatch(deleteUserFailure(data.message));
        return;
      }
      dispatch(deleteUserSuccess(data));
      dispatch(docterUnsetUser());
    } catch (error) {
      dispatch(deleteUserFailure(data.message));
    }
  };

  return (
    <div className='p-3 max-w-lg mx-auto'>
      <h1 className='text-3xl font-semibold text-center my-7'>Profile</h1>
      <form onSubmit={handleSubmit} className='flex flex-col gap-4'>
        <input
          type='file'
          ref={fileRef}
          hidden
          accept='image/*'
          onChange={(e) => setImage(e.target.files[0])}
        />
        {/* 
      firebase storage rules:  
      allow read;
      allow write: if
      request.resource.size < 2 * 1024 * 1024 &&
      request.resource.contentType.matches('image/.*') */}
        <div className="relative flex justify-center w-fit mx-auto group">

          {/* icon */}
          <svg className='absolute bottom-0 right-2 ' xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24">
            <path className='fill-transparent group-hover:fill-[#9718ec]' fill="" fill-rule="evenodd" d="M9.778 21h4.444c3.121 0 4.682 0 5.803-.735a4.408 4.408 0 0 0 1.226-1.204c.749-1.1.749-2.633.749-5.697c0-3.065 0-4.597-.749-5.697a4.407 4.407 0 0 0-1.226-1.204c-.72-.473-1.622-.642-3.003-.702c-.659 0-1.226-.49-1.355-1.125A2.064 2.064 0 0 0 13.634 3h-3.268c-.988 0-1.839.685-2.033 1.636c-.129.635-.696 1.125-1.355 1.125c-1.38.06-2.282.23-3.003.702A4.405 4.405 0 0 0 2.75 7.667C2 8.767 2 10.299 2 13.364c0 3.064 0 4.596.749 5.697c.324.476.74.885 1.226 1.204C5.096 21 6.657 21 9.778 21M12 9.273c-2.301 0-4.167 1.831-4.167 4.09c0 2.26 1.866 4.092 4.167 4.092c2.301 0 4.167-1.832 4.167-4.091c0-2.26-1.866-4.091-4.167-4.091m0 1.636c-1.38 0-2.5 1.099-2.5 2.455c0 1.355 1.12 2.454 2.5 2.454s2.5-1.099 2.5-2.454c0-1.356-1.12-2.455-2.5-2.455m4.722-.818c0-.452.373-.818.834-.818h1.11c.46 0 .834.366.834.818a.826.826 0 0 1-.833.818h-1.111a.826.826 0 0 1-.834-.818" clip-rule="evenodd" /></svg>

          <img
            src={formData.profilePicture || currentUser.profilePicture}
            alt='profile'
            className='h-24 w-24 self-center cursor-pointer rounded-full object-cover mt-2'
            onClick={() => fileRef.current.click()}
          />
        </div>
        <p className='text-sm self-center'>
          {imageError ? (
            <span className='text-red-700'>
              Error uploading image (file size must be less than 2 MB)
            </span>
          ) : imagePercent > 0 && imagePercent < 100 ? (
            <span className='text-slate-700'>{`Uploading: ${imagePercent} %`}</span>
          ) : imagePercent === 100 ? (
            <span className='text-green-700'>Image uploaded successfully</span>
          ) : (
            ''
          )}
        </p>
        <div className="mb-3">
          <div className='text-sm font-semibold text-gray-400 mb-1'>Username</div>

          <input
            defaultValue={currentUser.name}
            type='text'
            id='name'
            placeholder='Name'
            className='bg-white/60 rounded-lg p-3 border min-w-[100%]'
            onChange={handleChange}
          />
        </div>
        <div className="mb-3">
          <div className='text-sm font-semibold text-gray-400 mb-1'>Email Address</div>
          <input
            defaultValue={currentUser.email}
            type='email'
            id='email'
            placeholder='Email'
            className='bg-white/60 rounded-lg p-3 border min-w-[100%]'
            onChange={handleChange}
          />
        </div>

        <div className="mb-3">
          <div className='text-sm font-semibold text-gray-400 mb-1'>Select your device</div>
          <select onChange={handleChange} id='current_device' name="" className='bg-white/60 rounded-md p-3 border min-w-[100%] me-4'>
            {currentUser.current_device == 'C0680226' ? (
              <>
                <option value="C0680226" selected>C0680226</option>
                <option value="BA903328">BA903328</option>
              </>
              
            )  : (
              <>
                <option value="C0680226">C0680226</option>
                <option value="BA903328" selected>BA903328</option>
              </>
            ) }
          </select>
        
        </div>

        <div className="mb-3">
          <div className='text-sm font-semibold text-gray-400 mb-1'>Phone Number</div>
          <input
            defaultValue={currentUser.phone_number}
            type='text'
            id='phone_number'
            placeholder='Phone'
            className='bg-white/60 rounded-lg p-3 border min-w-[100%]'
            onChange={handleChange}
          />
        </div>
        <div className="mb-3">
          <div className='text-sm font-semibold text-gray-400 mb-1'>Address</div>
          <input
            defaultValue={currentUser.address}
            type='text'
            id='address'
            placeholder='Address'
            className='bg-white/60 rounded-lg p-3 border min-w-[100%]'
            onChange={handleChange}
          />
        </div>

        <div className="mb-3">
          <div className='text-sm font-semibold text-gray-400 mb-1'>Password</div>
          <input
            type='password'
            id='password'
            placeholder='Password'
            className='bg-white/60 rounded-lg p-3 border min-w-[100%]'
            onChange={handleChange}
          />
        </div>

        <button className='bg-slate-700 text-white p-3 rounded-lg uppercase hover:opacity-95 disabled:opacity-80'>
          {loading ? 'Loading...' : 'Update'}
        </button>
      </form>
      <div className='flex justify-between mt-5'>
        <span
          onClick={handleDeleteAccount}
          className='text-red-700 cursor-pointer'
        >
          Delete Account
        </span>
        <span onClick={handleSignOut} className='text-red-700 px-4 py-2 border rounded-md cursor-pointer hover:text-white hover:bg-red-700 duration-200'>
          Sign out
        </span>
      </div>
      {error ? (
        <p className='text-white px-16 py-4 mt-5 bg-red-700'>{error && 'Something went wrong!'}</p>
      ) : null}
      {updateSuccess ? (
        <p className='text-green text-white px-16 py-4 bg-green-500 mt-5'>
          {updateSuccess && 'User is updated successfully!'}
        </p>

      ) : null}
    </div>
  );
}
