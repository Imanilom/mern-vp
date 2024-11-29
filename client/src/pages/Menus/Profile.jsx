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
import { clearLogsWithDailytMetric } from '../../redux/user/webSlice';
import AOS from 'aos';


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
    AOS.init({
      duration: 700
    })
  }, [])
  useEffect(() => {
    if (image) {
      handleFileUpload(image);
    }
  }, [image]);

  useEffect(() => {
    console.log({formData})
  }, [formData])
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
      dispatch(clearLogsWithDailytMetric());
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
    <div className='bg-[#101010] dark:bg-[#FEFCF5] pb-12 pt-8' >
      <form  onSubmit={handleSubmit} className='p-3 md:flex lg:w-10/12 items-center w-11/12 mx-auto text-white dark:text-[#073B4C] bg-[#101010] dark:bg-[#FEFCF5]'>
        <div className="md:w-6/12 md:py-20 py-4">
          <h1 className='text-3xl font-semibold my-2'>Profile Informasi</h1>
          <div className='flex flex-col gap-4'>
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
            <div className="relative flex justify-center w-fit group">

              {/* icon */}
              {/* <svg className='absolute bottom-0 right-2 ' xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24">
                <path className='fill-transparent group-hover:fill-[#9718ec]' fill="" fill-rule="evenodd" d="M9.778 21h4.444c3.121 0 4.682 0 5.803-.735a4.408 4.408 0 0 0 1.226-1.204c.749-1.1.749-2.633.749-5.697c0-3.065 0-4.597-.749-5.697a4.407 4.407 0 0 0-1.226-1.204c-.72-.473-1.622-.642-3.003-.702c-.659 0-1.226-.49-1.355-1.125A2.064 2.064 0 0 0 13.634 3h-3.268c-.988 0-1.839.685-2.033 1.636c-.129.635-.696 1.125-1.355 1.125c-1.38.06-2.282.23-3.003.702A4.405 4.405 0 0 0 2.75 7.667C2 8.767 2 10.299 2 13.364c0 3.064 0 4.596.749 5.697c.324.476.74.885 1.226 1.204C5.096 21 6.657 21 9.778 21M12 9.273c-2.301 0-4.167 1.831-4.167 4.09c0 2.26 1.866 4.092 4.167 4.092c2.301 0 4.167-1.832 4.167-4.091c0-2.26-1.866-4.091-4.167-4.091m0 1.636c-1.38 0-2.5 1.099-2.5 2.455c0 1.355 1.12 2.454 2.5 2.454s2.5-1.099 2.5-2.454c0-1.356-1.12-2.455-2.5-2.455m4.722-.818c0-.452.373-.818.834-.818h1.11c.46 0 .834.366.834.818a.826.826 0 0 1-.833.818h-1.111a.826.826 0 0 1-.834-.818" clip-rule="evenodd" /></svg> */}

              <img
                src={formData.profilePicture || currentUser.profilePicture}
                alt='profile'
                className='h-full md:w-[80%] me-auto py-3 self-center cursor-pointer object-cover mt-2'
                onClick={() => fileRef.current.click()}
              />

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
            </div>
          </div>

          <div className="flex-col flex gap-3">
            <button className='bg-[#07AC7B] dark:bg-[#FFD166] md:w-3/4 text-white p-3 rounded-lg uppercase hover:opacity-95 disabled:opacity-80'>
              {loading ? 'Loading...' : 'Update Profile'}
            </button>

            <button onClick={handleSignOut} className='md:w-3/4 bg-[#920E0E] text-white px-4 uppercase py-3 rounded-md cursor-pointer hover:text-white hover:bg-red-700 duration-200'>
              LOGOUT ACCOUNT
            </button>

          </div>

          {error ? (
            <p className='text-white px-16 py-4 mt-5 md:w-3/4 text-center text-sm bg-red-700'>{error && 'Something went wrong!'}</p>
          ) : null}
          {updateSuccess ? (
            <p className='text-green md:w-3/4 rounded-md text-sm text-center text-white px-16 py-2 bg-green-500 dark:bg-[#FFD166] mt-5'>
              {updateSuccess && 'User is updated successfully!'}
            </p>

          ) : null}
        </div>

        <div className="md:w-6/12" data-aos="fade-right">

          <div className="md:flex-col gap-3">
            <div className="mb-3">
              <div className='text-sm font-semibold text-gray-400 dark:text-[#101010]/60 mb-1'>Username</div>
              <input
                defaultValue={currentUser.name}
                type='text'
                id='name'
                placeholder='Name'
                className='bg-[#2C2C2C]/40 dark:bg-[#F5F2E7] rounded-lg p-3 min-w-[100%]'
                onChange={handleChange}
              />
            </div>
            <div className="mb-3">
              <div className='text-sm font-semibold text-gray-400 dark:text-[#101010]/60 mb-1'>Email Address</div>
              <input
                defaultValue={currentUser.email}
                type='email'
                id='email'
                placeholder='Email'
                disabled
                className='bg-[#2C2C2C]/40 dark:bg-[#E7E7E7] rounded-lg p-3 min-w-[100%] '
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="lg:flex justify-between gap-1">
            <div className="mb-3">
              <div className='text-sm font-semibold text-gray-400 dark:text-[#101010]/60 mb-1'>Phone Number</div>
              <input
                defaultValue={currentUser.phone_number}
                type='text'
                id='phone_number'
                placeholder='Phone'
                className='bg-[#2C2C2C]/40 dark:bg-[#F5F2E7] rounded-lg p-3  min-w-[100%]'
                onChange={handleChange}
              />
            </div>
            {/* <div className="mb-3">
              <div className='text-sm font-semibold text-gray-400 mb-1'>Guid Device</div>
              <input
                defaultValue={currentUser.guid}
                type='text'
                id='phone_number'
                placeholder='Phone'
                className='bg-[#2C2C2C]/40 rounded-lg p-3  min-w-[100%]'
                onChange={handleChange}
              />
            </div> */}
            <div className="mb-3">
              <div className='text-sm font-semibold text-gray-400 dark:text-[#101010]/60 mb-1 min-w-[100%]'>Select your device</div>
              <select onChange={handleChange} id='current_device' name="" className='bg-[#2C2C2C]/40 dark:bg-[#F5F2E7] rounded-md p-3 lg:w-[270px] min-w-[100%]'>
                {currentUser.current_device == 'C0680226' ? (
                  <>
                    <option className='bg-[#2C2C2C]/40 dark:bg-[#F5F2E7]' value="C0680226" selected>C0680226</option>
                    <option className='bg-[#2C2C2C]/40 dark:bg-[#F5F2E7]' value="BA903328">BA903328</option>
                  </>

                ) : (
                  <>
                    <option value="C0680226">C0680226</option>
                    <option value="BA903328" selected>BA903328</option>
                  </>
                )}
              </select>

            </div>


          </div>
              
          <div className="md:flex-col gap-3">
            <div className="flex flex-col md:flex-row justify-between">

            <div className="mb-3">
              <div className='text-sm font-semibold dark:text-[#101010]/60 text-gray-400 mb-1'>Password</div>
              <input
                type='password'
                id='password'
                placeholder='Password'
                className='bg-[#2C2C2C]/40 rounded-lg p-3  min-w-[100%]'
                onChange={handleChange}
              />
            </div>
            <div className="mb-3">
              <div className='text-sm font-semibold dark:text-[#101010]/60 text-gray-400 mb-1' >Guid Device</div>
              <input
                defaultValue={currentUser.guid}
                type='text'
                id='guid'
                placeholder='guid device..'
                className='bg-[#2C2C2C]/40 dark:bg-[#F5F2E7] rounded-lg p-3  min-w-[100%] lg:w-[270px]'
                onChange={handleChange}
              />
            </div>
            </div>

            <div className="mb-3">
              <div className='text-sm font-semibold dark:text-[#101010]/60 text-gray-400 mb-1'>Address</div>
              <textarea
                type='text'
                id='address'
                placeholder='Address'
                className='bg-[#2C2C2C]/40 dark:bg-[#F5F2E7] h-32 rounded-lg p-3 min-w-[100%] items-start align-top'
                onChange={handleChange}
              >{currentUser.address}</textarea>
            </div>

          </div>

          <div className='flex justify-end mt-5'>
            <span
              onClick={handleDeleteAccount}
              className='text-red-700 font-semibold cursor-pointer'
            >
              Delete Account
            </span>

          </div>
        </div>


      </form>
    </div>
  );
}
