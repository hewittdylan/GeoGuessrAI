import os
import pandas as pd
import datasets
from os.path import join

# convert these to features
#id,latitude,longitude,thumb_original_url,country,sequence,captured_at,lon_bin,lat_bin,cell,region,sub-region,city,land_cover,road_index,drive_side,climate,soil,dist_sea,quadtree_10_5000,quadtree_10_25000,quadtree_10_1000,quadtree_10_50000,quadtree_10_12500,quadtree_10_500,quadtree_10_2500,unique_region,unique_sub-region,unique_city,unique_country,creator_username,creator_id
#3859149887465501,-43.804769384023,-176.61409250805,,8,"(0, 8)",Chatham Islands,,Waitangi,4,4.661764145,1,15,3,0.0068841379890803,0,0,0,0,0,0,0,Chatham Islands_NZ,,Waitangi_NaN_Chatham Islands_NZ,NZ,roadroid,111336221091714.0

class OSV5M(datasets.GeneratorBasedBuilder):
    def __init__(self, *args, **kwargs):
        self.full = kwargs.pop('full', False)
        super().__init__(*args, **kwargs)
        print('OSV5M', self.__dict__)

    def _info(self):
        if self.full:
            return datasets.DatasetInfo(
                features=datasets.Features(
                    {
                        "image": datasets.Image(),
                        "latitude": datasets.Value("float32"),
                        "longitude": datasets.Value("float32"),
                        "thumb_original_url": datasets.Value("string"),
                        "country": datasets.Value("string"),
                        "sequence": datasets.Value("string"),
                        "captured_at": datasets.Value("string"),
                        "lon_bin": datasets.Value("float32"),
                        "lat_bin": datasets.Value("float32"),
                        "cell": datasets.Value("string"),
                        "region": datasets.Value("string"),
                        "sub-region": datasets.Value("string"),
                        "city": datasets.Value("string"),
                        "land_cover": datasets.Value("float32"),
                        "road_index": datasets.Value("float32"),
                        "drive_side": datasets.Value("float32"),
                        "climate": datasets.Value("float32"),
                        "soil": datasets.Value("float32"),
                        "dist_sea": datasets.Value("float32"),
                        "quadtree_10_5000": datasets.Value("int32"),
                        "quadtree_10_25000": datasets.Value("int32"),
                        "quadtree_10_1000": datasets.Value("int32"),
                        "quadtree_10_50000": datasets.Value("int32"),
                        "quadtree_10_12500": datasets.Value("int32"),
                        "quadtree_10_500": datasets.Value("int32"),
                        "quadtree_10_2500": datasets.Value("int32"),
                        "unique_region": datasets.Value("string"),
                        "unique_sub-region": datasets.Value("string"),
                        "unique_city": datasets.Value("string"),
                        "unique_country": datasets.Value("string"),
                        "creator_username": datasets.Value("string"),
                        "creator_id": datasets.Value("string"),
                    }
                )
            )
        else:
            return datasets.DatasetInfo(
                features=datasets.Features(
                    {
                        "image": datasets.Image(),
                        "latitude": datasets.Value("float32"),
                        "longitude": datasets.Value("float32"),
                        "country": datasets.Value("string"),
                        "region": datasets.Value("string"),
                        "sub-region": datasets.Value("string"),
                        "city": datasets.Value("string"),
                    }
                )
            )

    def df(self, annotation_path):
        if not hasattr(self, 'df_'):
            self.df_ = {}
        if annotation_path not in self.df_:
            df = pd.read_csv(annotation_path, dtype={
                'id': str, 'creator_id': str, 'creator_username': str, 
                'unique_country': str, 'unique_city': str, 'unique_sub-region': str, 'unique_region': str,
                'quadtree_10_2500': int, 'quadtree_10_500': int, 'quadtree_10_12500': int, 'quadtree_10_50000': int, 'quadtree_10_1000': int, 'quadtree_10_25000': int, 'quadtree_10_5000': int,
                'dist_sea': float, 'soil': float, 'climate': float, 'drive_side': float, 'road_index': float, 'land_cover': float, 'city': str, 'sub-region': str, 'region': str, 'cell': str, 'lat_bin': float, 'lon_bin': float, 'captured_at': str, 'sequence': str, 'country': str, 'thumb_original_url': str, 'longitude': float, 'latitude': float
            })
            if not self.full:
                df = df[['id', 'latitude', 'longitude', 'country', 'region', 'sub-region', 'city']]

            df = df.set_index('id')
            self.df_[annotation_path] = df.to_dict('index')
        return self.df_[annotation_path]

    def _split_generators(self, dl_manager):
        _URLS = {
            "train": [join('images', 'train', str(i).zfill(2) + '.zip') for i in range(98)],
            "test": [join('images', 'test', str(i).zfill(2) + '.zip') for i in range(5)],
            "train_meta": "train.csv",
            "test_meta": "test.csv",
        }

        data_files = dl_manager.download_and_extract(_URLS)
        return [
            datasets.SplitGenerator(
                name=datasets.Split.TRAIN,
                gen_kwargs={
                    "image_paths": dl_manager.iter_files(data_files["train"]),
                    "annotation_path": data_files["train_meta"],
                },
            ),
            datasets.SplitGenerator(
                name=datasets.Split.TEST,
                gen_kwargs={
                    "image_paths": dl_manager.iter_files(data_files["test"]),
                    "annotation_path": data_files["test_meta"],
                },
            ),
        ]

    def _generate_examples(self, image_paths, annotation_path):
        """Generate examples."""
        df = self.df(annotation_path)
        for idx, image_path in enumerate(image_paths):
            info_id = os.path.splitext(os.path.split(image_path)[-1])[0]
            try:
                example = {
                    "image": image_path,
                } | df[info_id]
            except Exception as e:
                print('Exception ' + str(e), info_id, idx, image_path, sep='\n')
                continue

            yield idx, example