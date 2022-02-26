export function createPromise(callback)
{
	return new Promise(async(resolve,reject)=>{
		const success = callback();

		if( success )
		{
			resolve(success);
		}
		else
		{
			reject();
		}
	});
}