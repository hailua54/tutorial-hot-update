/*

_ Remove MD5 cache. build project to generate jsb files. Ex: jsb-default

_ generate : project.manifest + version.manifest
    + version_generator.js: 
        var dest = './remote-assets/'; // pass new value by -d param
        var src = './jsb/';            // pass new value by -s param
    + run cmd: node version_generator.js -v 1.0.0 -u http://your-server-address/tutorial-hot-update/remote-assets/ -s native/package/ -d assets/
        -v Specifies the major version number of the manifest file.
        -u Specifies the url of the server remote package, which needs to be the same as the remote package url of the manifest file in the original release version, otherwise the update can not be detected.
        -s local native published directory relative to the current path.
        -d the path of the output manifest file.
        EX:
        node version_generator.js -v 1.0.0 -u http://localhost:8080/public_web/hot_update_deploy/ -s ./build/jsb-default/ -d ./manifest_output

_ copy manifest_output/project.manifest -> asset/project.manifest to embed to the build for the first manifest load (later manifest files will be load from 
search path stored in localStorage).

_ build project again with the project.manifest in asset.

_ check jsb-default/main.js include the embeded code
    _ at the first time all game assets including project.manifest is loaded from internal application folder (read + not write)
    _ after the first hot update success, new search paths for all game assets and manifest will be updated (including new local
        storage path 'xxx' (read + write) and internal application path (read + nowrite) which order due to the search priority) 
    _ 'xxx_temp' will be the temp folder for downloading progress and 'xxx' will be the cache folder.
    */
    if (typeof window.jsb === 'object') {
        var hotUpdateSearchPaths = localStorage.getItem('HotUpdateSearchPaths');
        if (hotUpdateSearchPaths) { // in this case search path located in localStor
            var paths = JSON.parse(hotUpdateSearchPaths);
            jsb.fileUtils.setSearchPaths(paths);

            var fileList = [];
            var storagePath = paths[0] || '';
             
            var tempPath = storagePath + '_temp/';
            var baseOffset = tempPath.length;
 
            // if tempPath + project.manifest.temp exist => downloading in progress => donothing + let assetmaneger and hot update continue it's work
            // if tempPath + project.manifest.temp NOT exist => downloading success (xxx_temp renamed to xxx) => copy files from xxx_temp to xxx + delete xxx_temp.
            /*     + check AssetManagerEx.cpp
                        void AssetsManagerEx::initManifests()
                        {
                            //...
                            if (_tempManifest)
                            {
                                _tempManifest->parseFile(_tempManifestPath);
                                // Previous update is interrupted
                                if (_fileUtils->isFileExist(_tempManifestPath)) // exist => downloading in progress
                                {
                                    // Manifest parse failed, remove all temp files
                                    if (!_tempManifest->isLoaded())
                                    {
                                        _fileUtils->removeDirectory(_tempStoragePath);
                                        CC_SAFE_RELEASE(_tempManifest);
                                        _tempManifest = nullptr;
                                    }
                                }
                            }
                            //...
                        }

                        void AssetsManagerEx::updateSucceed()
                        {
                            // ...
                            // Every thing is correctly downloaded, do the following
                            // 1. rename temporary manifest to valid manifest
                            if (_fileUtils->isFileExist(_tempManifestPath)) {
                                _fileUtils->renameFile(_tempStoragePath, TEMP_MANIFEST_FILENAME, MANIFEST_FILENAME);
                            }
                        }
            */
            if (jsb.fileUtils.isDirectoryExist(tempPath) && !jsb.fileUtils.isFileExist(tempPath + 'project.manifest.temp')) {
                jsb.fileUtils.listFilesRecursively(tempPath, fileList);
                fileList.forEach(srcPath => {
                    var relativePath = srcPath.substr(baseOffset);
                    var dstPath = storagePath + relativePath;

                    if (srcPath[srcPath.length] == '/') {
                        cc.fileUtils.createDirectory(dstPath)
                    }
                    else {
                        if (cc.fileUtils.isFileExist(dstPath)) {
                            cc.fileUtils.removeFile(dstPath)
                        }
                        cc.fileUtils.renameFile(srcPath, dstPath);
                    }
                })
                cc.fileUtils.removeDirectory(tempPath);
            }
        }
    }

/*

- deploy:
    copy manifest_output/project.manifest + manifest_output/version.manifest jsb-default/assets + jsb-default/src to http://localhost:8080/public_web/hot_update_deploy

_ debug log:
    JS: loadLocalManifest old path assets/main/native/41/4128b78b-00ae-4d8a-ae35-4e5ca5c5cde9.manifest
    JS: after assetmanger load new manifest file success and use cache_folder as new path: getLocalManifest newPaths === ["/Users/tom/Documents/blackjack-remote-asset/"]
    
    check HotUpdate.js:
    this._am = new jsb.AssetsManager('', this._storagePath = "/Users/tom/Documents/blackjack-remote-asset/", this.versionCompareHandle);
    
    check AssetManagerEx.cpp
    void AssetsManagerEx::init(const std::string& manifestUrl, const std::string& storagePath)

    "/Users/tom/Documents/blackjack-remote-asset/" is passing from AssetManagerEx to HotUpdate via the ways:
        _fileUtils->setSearchPaths(...); and FileUtils::getInstance()->getSearchPaths()
    */
