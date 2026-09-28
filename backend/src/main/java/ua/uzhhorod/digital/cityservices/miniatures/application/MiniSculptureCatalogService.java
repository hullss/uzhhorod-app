package ua.uzhhorod.digital.cityservices.miniatures.application;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import org.springframework.stereotype.Service;
import ua.uzhhorod.digital.cityservices.miniatures.api.MiniSculptureListResponse;
import ua.uzhhorod.digital.cityservices.miniatures.api.MiniSculptureResponse;

/**
 * A deliberately small, source-checked seed catalog. It contains only facts
 * needed for a city walk; editorial descriptions and third-party media are not imported.
 */
@Service
public class MiniSculptureCatalogService {

    private static final Instant SOURCE_CHECKED_AT = Instant.parse("2026-09-26T00:00:00Z");

    private static final List<MiniSculptureResponse> SCULPTURES = List.of(
            sculpture("mikolaychyk", "Миколайчик", 48.622069, 22.298199, "площа Театральна", "Михайло Колодко", "2010-12-19", "Одна з перших мініскульптур міста, встановлена біля Ужа."),
            sculpture("mayak-ungvar", "Маяк Унгвар", 48.621217, 22.297856, "Православна набережна, 1", "Михайло Колодко", "2011-07-27", "Невеликий маяк на набережній, присвячений ужгородській регаті."),
            sculpture("ferenc-liszt", "Ференц Ліст", 48.624201, 22.297312, "площа Жупанатська", "Михайло Колодко", "2012-05-07", "Мініатюра композитора поруч з історичним центром."),
            sculpture("svejk", "Бравий солдат Швейк", 48.621410, 22.297453, "Київська набережна", "Михайло Колодко", "2012-07-10", "Бронзовий герой Ярослава Гашека на маршруті вздовж Ужа."),
            sculpture("vuzol-krotona", "Вузол Кротона", 48.621492, 22.297193, "Київська набережна", "Михайло Колодко, Василь Криванич", "2012-07-26", "Мініскульптура з математичним мотивом на перилах набережної."),
            sculpture("havrylo-hliuk", "Гаврило Глюк", 48.62579727, 22.30283165, "площа Гаврила Глюка", "Михайло Колодко", "2012-11-02", "Присвята закарпатському художнику на площі його імені."),
            sculpture("karpatiia", "Карпатія", 48.622083, 22.298086, "площа Театральна", "Михайло Колодко", "2013-04-15", "Мініатюрний корабель, що нагадує про водний шлях Ужем."),
            sculpture("ihlavski-yizhachky", "Їглавські їжачки", 48.622293, 22.294021, "Київська набережна", "Михайло Колодко, Василь Криванич", "2013-05-26", "Пара їжачків — символ дружби Ужгорода та Їглави."),
            sculpture("john-lord", "Джон Лорд", 48.622475, 22.296944, "набережна Незалежності", "Михайло Колодко", "2014-11-27", "Присвята клавішнику Deep Purple на набережній."),
            sculpture("malyi-uzh", "Малий Уж", 48.625091, 22.298392, "вул. Фединця, біля провулка Гірчичне зерно", "Михайло Колодко", "2015-02-07", "Маленький водолаз захований у старій частині міста."),
            sculpture("michael-strank", "Майкл Стренк", 48.625937, 22.296445, "вул. Тиха", "Михайло Колодко", "2015-02-17", "Пам'ять про американського військового з ужгородським корінням."),
            sculpture("bela-bartok", "Бейла Барток", 48.620560, 22.299670, "Православна набережна, 12", "Михайло Колодко", "2015-09-25", "Мініатюра композитора неподалік набережної."),
            sculpture("krtchek", "Кртчек", 48.623690, 22.285920, "міст Масарика", "Роман Мурник", "2022-07-15", "Герой чеського мультфільму на мосту Масарика."),
            sculpture("nashi-kozaky", "Наші козаки", 48.624690, 22.295950, "альпінарій біля Закарпатського художнього музею", "Роман Мурник", "2022-10-14", "Козацький сюжет у тихому куточку поруч із музеєм."),
            sculpture("uzhanska-rusalonka", "Ужанська русалонька", 48.621570, 22.297920, "пішохідний міст", "Роман Мурник", "2023-08-11", "Русалонька на перилах пішохідного мосту."),
            sculpture("alma-mater", "Alma Mater", 48.635490, 22.290880, "вул. Університетська, 14", "Роман Мурник", "2023-09-01", "Мініскульптура біля Ужгородського національного університету."),
            sculpture("legendy-zamkiv", "Легенди Закарпатських замків", 48.621200, 22.307960, "Ужгородський замок", "Роман Мурник", "2023-09-09", "Скульптура на бастіоні Ужгородського замку."),
            sculpture("castrum-ung", "Castrum Ung", 48.621720, 22.308310, "вул. Підградська, 40", "Ян-Павло Роман", "2023-09-10", "Мініатюра, що відсилає до давнього Ужгорода."),
            sculpture("ekskursovod", "Екскурсовод", 48.620160, 22.304640, "вул. Ольбрахта, 6", "Роман Мурник", "2023-10-24", "Маленький провідник для прогулянок старим містом."),
            sculpture("laszlo-biro", "Ласло Біро", 48.621390, 22.297790, "пішохідний міст", "Роман Мурник", "2023-12-06", "Присвята винахіднику кулькової ручки."),
            sculpture("nandor-ploteni", "Нандор Плотені", 48.621470, 22.297700, "пішохідний міст", "Роман Мурник", "2023-12-13", "Скульптура, присвячена закарпатському скрипалю.")
    );

    public MiniSculptureListResponse getCatalog() {
        return new MiniSculptureListResponse(
                SOURCE_CHECKED_AT,
                "Каталог поступово звіряємо на місці. Перед прогулянкою перевірте, чи скульптуру не перенесли на реставрацію.",
                SCULPTURES);
    }

    private static MiniSculptureResponse sculpture(
            String id, String title, double latitude, double longitude, String address, String author, String installedAt, String summary) {
        return new MiniSculptureResponse(id, title, latitude, longitude, address, author, LocalDate.parse(installedAt), summary);
    }
}
