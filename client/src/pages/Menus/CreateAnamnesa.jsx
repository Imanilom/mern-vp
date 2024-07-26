import { Link } from "react-router-dom";

function CreateAnamnesa() {
    const handleSubmit = async () => {

    }
    return (
        <div class="flex min-h-[90vh] items-center justify-start bg-white">
            <div class="mx-auto w-full max-w-lg">
                <h1 class="text-4xl font-medium">Create Anamnesa</h1>
                <p class="mt-3">Insert below</p>

                <form onSubmit={handleSubmit} method='post' class="mt-10">
                    <div class="grid gap-6 mt-5 mb-5 sm:grid-cols-1">
                        <div class="relative z-0">
                            <input type="text" name="name" class="peer block w-full appearance-none border-0 border-b border-gray-500 bg-transparent py-2.5 px-0 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-0" placeholder=" " />
                            <label class="absolute top-3 -z-10 origin-[0] -translate-y-6 scale-75 transform text-sm text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-0 peer-focus:-translate-y-6 peer-focus:scale-75 peer-focus:text-blue-600 peer-focus:dark:text-blue-500">Tuliskan Pertanyaan</label>
                        </div>
                        <div class="relative z-0">
                            <input type="text" name="name" class="peer block w-full appearance-none border-0 border-b border-gray-500 bg-transparent py-2.5 px-0 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-0" placeholder=" " />
                            <label class="absolute top-3 -z-10 origin-[0] -translate-y-6 scale-75 transform text-sm text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-0 peer-focus:-translate-y-6 peer-focus:scale-75 peer-focus:text-blue-600 peer-focus:dark:text-blue-500">Tuliskan Jawaban</label>
                        </div>
                    </div>
                    
                    <div className="flex gap-2">
                        <button type="submit" class="mt-5 rounded-md bg-black px-5 py-2 text-white">Create Anamnesa</button>
                        <Link to='/riwayat-medis' class="mt-5 rounded-md border border-gray-400/20 hover:border-gray-400/70 hover:shadow-xl px-10 py-2 text-black">Cancel</Link>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default CreateAnamnesa;