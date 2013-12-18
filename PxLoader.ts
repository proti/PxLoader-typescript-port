// TypeScript port of PxLoader lib, PxLoaderImage, PxLoaderJSON plugins
// Project: http://thinkpixellab.com/pxloader/
// JavaScript version PxLoaderJSON: https://gist.github.com/tdreyno/3605248 by Thomas Reynolds
// Github: https://github.com/proti/PxLoader-typescript-port

/*
    Copyright (c) 2013 Mariusz Protasewicz
    version: 0.2 alpha
    
    The MIT License

	Copyright (c) 2012 Pixel Lab

	Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

module px
{
    // Tag object to handle tag intersection; once created not meant to be changed
    // Performance rationale: http://jsperf.com/lists-indexof-vs-in-operator/3
    export class PxLoaderTags
    {
        public all : Array;
        private first;
        private length : number;
        private lookup;

        constructor(values)
        {
            this.all = [];
            this.first = null; // cache the first value
            this.length = 0;

            // holds values as keys for quick lookup
            this.lookup = {};

            if (values) {

                // first fill the array of all values
                if (Array.isArray(values)) {
                    // copy the array of values, just to be safe
                    this.all = values.slice(0);
                } else if (typeof values === 'object') {
                    for (var key in values) {
                        if(values.hasOwnProperty(key)) {
                            this.all.push(key);
                        }
                    }
                } else {
                    this.all.push(values);
                }

                // cache the length and the first value
                this.length = this.all.length;
                if (this.length > 0) {
                    this.first = this.all[0];
                }

                // set values as object keys for quick lookup during intersection test
                for (var i = 0; i < this.length; i++) {
                    this.lookup[this.all[i]] = true;
                }
            }
        }

        // compare this object with another; return true if they share at least one value
        public intersects(other) : Boolean
        {
            // handle empty values case
            if (this.length === 0 || other.length === 0) {
                return false;
            }

            // only a single value to compare?
            if (this.length === 1 && other.length === 1) {
                return this.first === other.first;
            }

            // better to loop through the smaller object
            if (other.length < this.length) {
                return other.intersects(this);
            }

            // loop through every key to see if there are any matches
            for (var key in this.lookup) {
                if (other.lookup[key]) {
                    return true;
                }
            }

            return false;
        }
    }

    export class PxSettings
    {
        public statusInterval : number;
        public loggingDelay : number;
        public noProgressTimeout : number;

        constructor(){}
    }

    class ResourceState {
        static QUEUED : number =  0;
        static WAITING : number = 1;
        static LOADED : number = 2;
        static ERROR : number = 3;
        static TIMEOUT : number = 4;
    }

    export class PxLoader
    {
        public settings : PxSettings;
        public entries : Array;
        public progressListeners : Array;
        public timeStarted : number;
        public progressChanged : number;

        constructor(settings : PxSettings = null)
        {
            settings = settings || new PxSettings();
            this.settings = settings;

            this.entries = [];
            this.progressListeners = [];

            // how frequently we poll resources for progress
            if (this.settings.statusInterval == null) {
                this.settings.statusInterval = 5000; // every 5 seconds by default
            }

            // delay before logging since last progress change
            if (this.settings.loggingDelay == null) {
                this.settings.loggingDelay = 20 * 1000; // log stragglers after 20 secs
            }

            // stop waiting if no progress has been made in the moving time window
            if (this.settings.noProgressTimeout == null) {
                this.settings.noProgressTimeout = Infinity; // do not stop waiting by default
            }

            // holds resources to be loaded with their status
            this.progressChanged = Date.now();
        }

        public add(resource) : void
        {
            // TODO: would be better to create a base class for all resources and
            // initialize the PxLoaderTags there rather than overwritting tags here
            resource.tags = new PxLoaderTags(resource.tags);

            // ensure priority is set
            if (resource.priority == null) {
                resource.priority = Infinity;
            }

            /**
             * The status of a resource
             * @enum {number}
             */
            this.entries.push(<any>{
                resource: resource,
                status: ResourceState.QUEUED
            });
        }

        public addProgressListener(callback, tags : PxLoaderTags = null) : void
        {
           this.progressListeners.push(<any>{
                callback: callback,
                tags: new PxLoaderTags(tags)
            })
        }

        public addCompletionListener(callback, tags : PxLoaderTags = null)
        {
            this.progressListeners.push(<any>{
                tags: new PxLoaderTags(tags),
                callback: function(e) {
                    if (e.completedCount === e.totalCount) {
                        callback(e);
                    }
                }
            })
        }

        public start(orderedTags : Array = null) : void
        {
            this.timeStarted = Date.now();

            // first order the resources
            var compareResources = new ResourceSort(orderedTags);
            this.entries.sort(compareResources.sort);

            // trigger requests for each resource
            for (var i = 0, len = this.entries.length; i < len; i++) {
                var entry = this.entries[i];
                entry['status'] = ResourceState.WAITING;
                entry['resource'].start(this);
            }

            // do an initial status check soon since items may be loaded from the cache
            setTimeout(this.statusCheck, 100);
        }

        public statusCheck = () : void =>
        {
            var checkAgain = false;
            var noProgressTime = Date.now() - this.progressChanged;
            var timedOut = (noProgressTime >= this.settings.noProgressTimeout);
            var shouldLog = (noProgressTime >= this.settings.loggingDelay);

            for (var i = 0, len = this.entries.length; i < len; i++) {
                var entry = this.entries[i];
                if (entry['status'] !== ResourceState.WAITING) {
                    continue;
                }

                // see if the resource has loaded
                if (entry['resource'].checkStatus) {
                    entry['resource'].checkStatus();
                }

                // if still waiting, mark as timed out or make sure we check again
                if (entry['status'] === ResourceState.WAITING) {
                    if (timedOut) {
                        entry['resource'].onTimeout();
                    } else {
                        checkAgain = true;
                    }
                }
            }

            // log any resources that are still pending
            if (shouldLog && checkAgain) {
                this.log();
            }

            if (checkAgain) {
                setTimeout(this.statusCheck, this.settings.statusInterval);
            }
        }

        public isBusy() : Boolean
        {
            for (var i = 0, len = this.entries.length; i < len; i++) {
                if (this.entries[i]['status'] === ResourceState.QUEUED || this.entries[i]['status'] === ResourceState.WAITING) {
                    return true;
                }
            }
            return false;
        }

        public onProgress(resource, statusType) : void
        {
            var entry = null,
                i, len, numResourceTags, listener, shouldCall;

            // find the entry for the resource
            for (i = 0, len = this.entries.length; i < len; i++) {
                if (this.entries[i]['resource'] === resource) {
                    entry = this.entries[i];
                    break;
                }
            }

            // we have already updated the status of the resource
            if (entry == null || entry['status'] !== ResourceState.WAITING) {
                return;
            }
            entry['status'] = statusType;
            this.progressChanged = Date.now();

            numResourceTags = resource.tags.length;

            // fire callbacks for interested listeners
            for (i = 0, len = this.progressListeners.length; i < len; i++) {

                listener = this.progressListeners[i];
                if (listener.tags.length === 0) {
                    // no tags specified so always tell the listener
                    shouldCall = true;
                } else {
                    // listener only wants to hear about certain tags
                    shouldCall = resource.tags.intersects(listener.tags);
                }

                if (shouldCall) {
                    this.sendProgress(entry, listener);
                }
            }
        }
        public onLoad(resource) : void
        {
            this.onProgress(resource, ResourceState.LOADED);
        }

        public onError(resource)  : void
        {
            this.onProgress(resource, ResourceState.ERROR);
        }

        public onTimeout(resource) : void
        {
            this.onProgress(resource, ResourceState.TIMEOUT);
        }

        public sendProgress(updatedEntry, listener) : void
        {
            // find stats for all the resources the caller is interested in
            var completed = 0,
                total = 0,
                i, len, entry, includeResource;
            for (i = 0, len = this.entries.length; i < len; i++) {

                entry = this.entries[i];
                includeResource = false;

                if (listener.tags.length === 0) {
                    // no tags specified so always tell the listener
                    includeResource = true;
                } else {
                    includeResource = entry.resource.tags.intersects(listener.tags);
                }

                if (includeResource) {
                    total++;
                    if (entry.status === ResourceState.LOADED ||
                        entry.status === ResourceState.ERROR ||
                        entry.status === ResourceState.TIMEOUT) {

                        completed++;
                    }
                }
            }

            listener.callback({
                // info about the resource that changed
                resource: updatedEntry.resource,

                // should we expose StatusType instead?
                loaded: (updatedEntry.status === ResourceState.LOADED),
                error: (updatedEntry.status === ResourceState.ERROR),
                timeout: (updatedEntry.status === ResourceState.TIMEOUT),

                // updated stats for all resources
                completedCount: completed,
                totalCount: total
            });
        }

        public log(showAll : Boolean = false) :void
        {
            if (!window.console) {
                return;
            }

            var elapsedSeconds = Math.round((Date.now() - this.timeStarted) / 1000);
            window.console.log('PxLoader elapsed: ' + elapsedSeconds + ' sec');

            for (var i = 0, len = this.entries.length; i < len; i++) {
                var entry = this.entries[i];
                if (!showAll && entry['status'] !== ResourceState.WAITING) {
                    continue;
                }

                var message = 'PxLoader: #' + i + ' ' + entry['resource'].getName();
                switch(entry['status']) {
                    case ResourceState.QUEUED:
                        message += ' (Not Started)';
                        break;
                    case ResourceState.WAITING:
                        message += ' (Waiting)';
                        break;
                    case ResourceState.LOADED:
                        message += ' (Loaded)';
                        break;
                    case ResourceState.ERROR:
                        message += ' (Error)';
                        break;
                    case ResourceState.TIMEOUT:
                        message += ' (Timeout)';
                        break;
                }

                if (entry['resource'].tags.length > 0) {
                    message += ' Tags: [' + entry['resource'].tags.all.join(',') + ']';
                }

                window.console.log(message);
            }
        }
    }

    export class ResourceSort
    {
        private orderedTags : Array;

        constructor(orderedTags)
        {
            this.orderedTags = this.ensureArray(orderedTags);
        }

        public sort = (a, b) : number =>
        {
            // check tag order first
            var aOrder = this.getTagOrder(a);
            var bOrder = this.getTagOrder(b);
            if (aOrder < bOrder) { return -1; }
            if (aOrder > bOrder) { return 1; }

            // now check priority
            if (a.priority < b.priority) { return -1; }
            if (a.priority > b.priority) { return 1; }
            return 0;
        }

        private ensureArray(val) : Array
        {
            if (val == null) {
                return [];
            }

            if (Array.isArray(val)) {
                return val;
            }

            return [val];
        }

        public getTagOrder(entry) : number
        {
            var resource = entry.resource,
                bestIndex = Infinity;
            for (var i = 0; i < resource.tags.length; i++) {
                for (var j = 0; j < Math.min(this.orderedTags.length, bestIndex); j++) {
                    if (resource.tags.all[i] === this.orderedTags[j] && j < bestIndex) {
                        bestIndex = j;
                        if (bestIndex === 0) {
                            break;
                        }
                    }
                    if (bestIndex === 0) {
                        break;
                    }
                }
            }
            return bestIndex;
        }
    }

    export class PxLoaderImage
    {
        public img : HTMLImageElement;
        public tags : PxLoaderTags;
        public priority : number;
        public url : string;
        public loader : PxLoader = null;

        constructor(url : string, tags : PxLoaderTags = null , priority : number = null)
        {
            this.url = url;
            this.img = new Image();
            this.tags = tags;
            this.priority = priority;
        }

        public start(pxLoader : PxLoader) : void
        {
            // we need the loader ref so we can notify upon completion
            this.loader = pxLoader;

            // NOTE: Must add event listeners before the src is set. We
            // also need to use the readystatechange because sometimes
            // load doesn't fire when an image is in the cache.
            this.bind('load', this.onLoad);
            this.bind('readystatechange', this.onReadyStateChange);
            this.bind('error', this.onError);

            this.img.src = this.url;
        }

        public onReadyStateChange = () : void =>
        {
            if (this.img.readyState === 'complete') {
                this.removeEventHandlers();
                this.loader.onLoad(this);
            }
        }

        public onLoad = () : void =>
        {
            this.removeEventHandlers();
            this.loader.onLoad(this);
        }

        public onError = () : void =>
        {
            this.removeEventHandlers();
            this.loader.onError(this);
        }

        public removeEventHandlers = () : void =>
        {
            this.unbind('load', this.onLoad);
            this.unbind('readystatechange', this.onReadyStateChange);
            this.unbind('error', this.onError);
        }

        // called by PxLoader to check status of image (fallback in case
        // the event listeners are not triggered).
        public checkStatus = () : void =>
        {
            if (this.img.complete) {
                this.removeEventHandlers();
                this.loader.onLoad(this);
            }
        }

        // called by PxLoader when it is no longer waiting
        public onTimeout = () : void =>
        {
            this.removeEventHandlers();
            if (this.img.complete) {
                this.loader.onLoad(this);
            } else {
                this.loader.onTimeout(this);
            }
        }

        // returns a name for the resource that can be used in logging
        public getName() : string
        {
            return this.url;
        }

        // cross-browser event binding
        public bind(eventName, eventHandler) :void
        {
            if (this.img.addEventListener) {
                this.img.addEventListener(eventName, eventHandler, false);
            } else if (this.img.attachEvent) {
                this.img.attachEvent('on' + eventName, eventHandler);
            }
        }

        // cross-browser event un-binding
        public unbind(eventName, eventHandler) : void
        {
            if (this.img.removeEventListener) {
                this.img.removeEventListener(eventName, eventHandler, false);
            } else if (this.img.detachEvent) {
                this.img.detachEvent('on' + eventName, eventHandler);
            }
        }

        public addImage(url : string, tags : PxLoaderTags, priority : number) : HTMLImageElement
        {
            var imageLoader : PxLoaderImage = new PxLoaderImage(url, tags, priority);
            this.loader.add(imageLoader);

            // return the img element to the caller
            return imageLoader.img;
        }
    }

    export class PxLoaderJSON
    {
        public loader : PxLoader;
        public url : string;
        public complete : Boolean = false;
        public tags : PxLoaderTags;
        public priority : number;
        public xhr : XMLHttpRequest;
        public data : any;

        constructor(url : string, tags : PxLoaderTags = null, priority : number = null)
        {
            this.url = url;
            this.tags = tags;
            this.priority = priority;
            this.data = null;

        }

        public start(pxLoader : PxLoader) : void
        {
            this.loader = pxLoader;

            this.xhr = new XMLHttpRequest();
            this.xhr.open("GET", this.url, false);
            this.xhr.onreadystatechange = this.onXHRReadyStateChange;
            this.xhr.send(null);
        }

        private onXHRReadyStateChange = () : void =>
        {
            if (this.xhr['readyState'] !== 4) { return; }
            if (this.xhr['status'] !== 200) {
                this.loader.onError(this);
                return;
            }

            var serverResponse : string = this.xhr['responseText'];
            //console.log(serverResponse);
            try {
                this.data = JSON.parse(serverResponse);
                this.loader.onLoad(this);
            } catch (e) {
                this.loader.onError(this);
            }
        }

        public checkStatus = () : void =>
        {
            if (this.complete) {
                this.loader.onLoad(this);
            }
        }

        // called by PxLoader when it is no longer waiting
        public onTimeout = () : void =>
        {
            if (this.complete) {
                this.loader.onLoad(this);
            } else {
                this.loader.onTimeout(this);
            }
        }

        // returns a name for the resource that can be used in logging
        public getURL() : string
        {
            return this.url;
        }

        public getData()
        {
            return this.data;
        }

        public addJSON(url : string, tags : PxLoaderTags, priority : number) : string
        {
            var jsonLoader : PxLoaderJSON = new PxLoaderJSON(url, tags, priority);
            this.loader.add(jsonLoader);

            return jsonLoader.url;
        }
    }
}