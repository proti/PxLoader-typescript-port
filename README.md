# PxLoader for TypeScript  
#####version: 0.1 alpha
---
* TypeScript port of PxLoader lib and PxLoaderImage plugin
* Project: http://thinkpixellab.com/pxloader
* Github: https://github.com/proti/PxLoader-typescript-port


Copyright (c) 2013 Mariusz Protasewicz  
 

PxLoader, PxLoaderImage plugin for TypeScript  
Release Date: 16/12/2013  
Platform: TypeScript  

This port, is inspired originally from JavaScript PxLoader and PxLoaderImage plugin 
by Pixel Labs.

This is the initial alpha version and need some refactoring, updates and tests.


#### Usage
```typescript
///<reference path="PxLoader.ts"/>
class Preload
{
	constructor()
	{
		var baseUrl : string = 'http://thinkpixellab.com/pxloader' + 
        '/slowImage.php?delay=1&time=' + new Date,
        
		var loader : px.PxLoader = new px.PxLoader();
		
		for(var i : number = 0; i < 100; i++)
        {
            var pxImage : px.PxLoaderImage = new px.PxLoaderImage(baseUrl + '&i=' + i);
            loader.add(pxImage);
           
           	loader.addProgressListener(this.onProgress);
       		loader.addCompletionListener(this.onComplete);
        }
	}
	
	public onProgress = (e) : void =>
    {
            console.log("items loaded: " + (e.completedCount / e.totalCount));
    }

    public onComplete = (e) : void =>
    {
        console.log("Loading completed.");
    }
    
}    
```
The MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
