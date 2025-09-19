const youtubedl = require('youtube-dl-exec');

async function test() {
  try {
    console.log('Testing youtube-dl-exec...');
    console.log('youtubedl type:', typeof youtubedl);
    console.log('youtubedl:', youtubedl);

    const result = await youtubedl('https://www.youtube.com/watch?v=dQw4w9WgXcQ', {
      dumpSingleJson: true,
      noCheckCertificates: true,
      noWarnings: true,
      preferFreeFormats: true,
    });

    console.log('Result type:', typeof result);
    console.log('Result is null:', result === null);
    console.log('Result is undefined:', result === undefined);

    if (result) {
      console.log('Keys in result object:', Object.keys(result));
      console.log('Title:', result.title);
      console.log('Formats available:', result.formats ? result.formats.length : 'No formats');
    } else {
      console.log('No result returned');
    }
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

test();