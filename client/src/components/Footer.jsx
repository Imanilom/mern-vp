import { Link } from "react-router-dom";
import logo_vidyamedic from '../assets/images/logoreal.png';

function Footer() {
    return (
        <div className=" border-t border-[#363636] bg-[#101010] text-white/90">
            <footer className="py-8 px-8 md:px-24 md:justify-between bg-[#101010] md:py-16 flex flex-col md:flex-row gap-8">
                <div className="md:w-5/12">
                    {/* logo */}
                    {/* <div className="w-16 h-16 bg-green-500 mb-3"></div> */}
                    <img src={logo_vidyamedic} width={230} alt="" />

                    <p className="mt-3 text-normal">Gabung bersama kami dan pantau aktivitas, kesehatan, serta kebugaran Anda secara otomatis dengan perangkat pintar.</p>
                    {/* <h1 className='font-bold ms-4 text-[18px] sm:text-xl flex flex-wrap'>
                        <span className='text-slate-500'>Vidya</span>
                        <span className='text-slate-700'>Medic</span>
                    </h1> */}
                </div>

                {/* another action */}
                <div className="flex justify-start gap-8 md:justify-start w-full flex-wrap md:gap-10 lg:gap-16">
                    <div className="sosial">
                        <p className="font-bold mb-3">FIND OUR SOSIAL</p>
                        <div className="flex gap-3">

                            {/* facebook */}
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="white" d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95" /></svg>

                            {/* instagram */}
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="white" d="M13.028 2c1.125.003 1.696.009 2.189.023l.194.007c.224.008.445.018.712.03c1.064.05 1.79.218 2.427.465c.66.254 1.216.598 1.772 1.153a4.9 4.9 0 0 1 1.153 1.772c.247.637.415 1.363.465 2.428c.012.266.022.487.03.712l.006.194c.015.492.021 1.063.023 2.188l.001.746v1.31a79 79 0 0 1-.023 2.188l-.006.194c-.008.225-.018.446-.03.712c-.05 1.065-.22 1.79-.466 2.428a4.9 4.9 0 0 1-1.153 1.772a4.9 4.9 0 0 1-1.772 1.153c-.637.247-1.363.415-2.427.465l-.712.03l-.194.006c-.493.014-1.064.021-2.189.023l-.746.001h-1.309a78 78 0 0 1-2.189-.023l-.194-.006a63 63 0 0 1-.712-.031c-1.064-.05-1.79-.218-2.428-.465a4.9 4.9 0 0 1-1.771-1.153a4.9 4.9 0 0 1-1.154-1.772c-.247-.637-.415-1.363-.465-2.428l-.03-.712l-.005-.194A79 79 0 0 1 2 13.028v-2.056a79 79 0 0 1 .022-2.188l.007-.194c.008-.225.018-.446.03-.712c.05-1.065.218-1.79.465-2.428A4.9 4.9 0 0 1 3.68 3.678a4.9 4.9 0 0 1 1.77-1.153c.638-.247 1.363-.415 2.428-.465c.266-.012.488-.022.712-.03l.194-.006a79 79 0 0 1 2.188-.023zM12 7a5 5 0 1 0 0 10a5 5 0 0 0 0-10m0 2a3 3 0 1 1 .001 6a3 3 0 0 1 0-6m5.25-3.5a1.25 1.25 0 0 0 0 2.5a1.25 1.25 0 0 0 0-2.5" /></svg>

                            {/* twitter */}

                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="white" d="M22.213 5.656a8.4 8.4 0 0 1-2.402.658A4.2 4.2 0 0 0 21.649 4c-.82.488-1.719.83-2.655 1.015a4.182 4.182 0 0 0-7.126 3.814a11.87 11.87 0 0 1-8.621-4.37a4.17 4.17 0 0 0-.566 2.103c0 1.45.739 2.731 1.86 3.481a4.2 4.2 0 0 1-1.894-.523v.051a4.185 4.185 0 0 0 3.355 4.102a4.2 4.2 0 0 1-1.89.072A4.185 4.185 0 0 0 8.02 16.65a8.4 8.4 0 0 1-6.192 1.732a11.83 11.83 0 0 0 6.41 1.88c7.694 0 11.9-6.373 11.9-11.9q0-.271-.012-.541a8.5 8.5 0 0 0 2.086-2.164" /></svg>


                            {/* Linkedin */}

                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 16 16"><path fill="white" d="M0 1.146C0 .513.526 0 1.175 0h13.65C15.474 0 16 .513 16 1.146v13.708c0 .633-.526 1.146-1.175 1.146H1.175C.526 16 0 15.487 0 14.854zm4.943 12.248V6.169H2.542v7.225zm-1.2-8.212c.837 0 1.358-.554 1.358-1.248c-.015-.709-.52-1.248-1.342-1.248S2.4 3.226 2.4 3.934c0 .694.521 1.248 1.327 1.248zm4.908 8.212V9.359c0-.216.016-.432.08-.586c.173-.431.568-.878 1.232-.878c.869 0 1.216.662 1.216 1.634v3.865h2.401V9.25c0-2.22-1.184-3.252-2.764-3.252c-1.274 0-1.845.7-2.165 1.193v.025h-.016l.016-.025V6.169h-2.4c.03.678 0 7.225 0 7.225z" /></svg>
                        </div>
                    </div>

                    <div className="product text-normal">
                        <p className="font-bold mb-3">COMPANY</p>
                        <div className="flex flex-col gap-3 blue cursor-pointer font-medium">
                            <a href="">
                                About us
                            </a>
                            <a href="">
                                Team
                            </a>
                            <a href="">
                                Media
                            </a>
                            <a href="">
                                Contacts & Imprint
                            </a>
                        </div>
                    </div>

                    <div className="product text-normal lg:w-5/12">
                        <p className="font-bold mb-3">OUR LOCATION</p>
                        <div className="flex flex-col gap-3 blue cursor-pointer font-medium">
                           <a href="">Jl. Ganesa No.10, Lb. Siliwangi, Kecamatan Coblong, Kota Bandung, Jawa Barat 40132</a>
                        </div>
                    </div>

                </div>
            </footer>
        </div>
    )
}

export default Footer;